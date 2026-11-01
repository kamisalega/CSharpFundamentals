using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Shouldly;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;
using StranglerFig.Migration.IntegrationEvents;

namespace StranglerFig.IntegrationTests;

// Step 3, option B, the Evently way:
// facade -> IEventBus (MassTransit) -> IntegrationEventConsumer stores it in orders.inbox_messages
// -> ProcessInboxJob -> LegacyOrderPlacedIntegrationEventHandler (Presentation) -> ImportOrderCommand (Application).
public sealed class EventSyncTests(LegacyEnvironment legacy)
    : IntegrationTest(legacy, MigrationPhase.Routing, SyncStrategy.Events)
{
    [Fact]
    public async Task PlacedOrder_ArrivesInNewModule_ThroughTheInbox()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        await EventuallyAsync(
            async () => await GetFromNewModuleAsync(placed.Id) is not null,
            "the inbox job should import the order");

        (await GetFromNewModuleAsync(placed.Id)).ShouldBe(placed);

        const string sql =
            """
            SELECT processed_on_utc IS NOT NULL AND error IS NULL
            FROM orders.inbox_messages
            WHERE content ->> 'OrderId' = @OrderId
            """;

        (await QueryModuleDatabaseAsync<bool>(sql, new { OrderId = placed.Id.ToString() })).ShouldBeTrue();
    }

    [Fact]
    public async Task Events_SyncOnlyWhatIsPublished()
    {
        // The facade publishes LegacyOrderPlacedIntegrationEvent but nothing when an order is shipped.
        // That is exactly the kind of gap the parallel run is meant to catch before cutover.
        OrderDto placed = await Api.PlaceOrderAsync(Ct);
        await EventuallyAsync(async () => await GetFromNewModuleAsync(placed.Id) is not null, "the order should arrive");

        await Api.ShipOrderAsync(placed.Id, Ct);

        (await Api.GetOrderOrThrowAsync(placed.Id, Ct)).Status.ShouldBe("Shipped");
        (await GetFromNewModuleAsync(placed.Id))!.Status.ShouldBe("Pending");
    }

    [Fact]
    public async Task OrderWrittenDirectlyToLegacy_BypassingTheFacade_IsNotSynced()
    {
        // Legacy's own UI or batch jobs never go through the facade, so no event is published.
        // The watermark job (option A) doesn't have this blind spot - it reads the table itself.
        Guid orderId = await Legacy.PlaceOrderAsync("direct@legacy.local", 10m, Ct);

        // A few inbox cycles: if an event existed, it would have been processed by now.
        await Task.Delay(TimeSpan.FromSeconds(3), Ct);

        (await Api.GetOrderAsync(orderId, Ct)).StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);
        (await GetFromNewModuleAsync(orderId)).ShouldBeNull();
    }

    [Fact]
    public async Task RedeliveredEvent_IsStoredInTheInboxOnlyOnce()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);
        var redelivered = new LegacyOrderPlacedIntegrationEvent(
            Guid.NewGuid(), DateTime.UtcNow, placed.Id, placed.CustomerEmail, placed.Total, placed.CreatedAtUtc);

        using (IServiceScope scope = App.Services.CreateScope())
        {
            IEventBus eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();
            await eventBus.PublishAsync(redelivered, Ct);
            await eventBus.PublishAsync(redelivered, Ct);
        }

        await EventuallyAsync(
            async () => await QueryModuleDatabaseAsync<bool>(
                "SELECT processed_on_utc IS NOT NULL FROM orders.inbox_messages WHERE id = @Id",
                new { redelivered.Id }),
            "the redelivered event should be processed");

        (await QueryModuleDatabaseAsync<int>(
            "SELECT count(*)::int FROM orders.inbox_messages WHERE id = @Id",
            new { redelivered.Id })).ShouldBe(1);
        (await GetFromNewModuleAsync(placed.Id)).ShouldBe(placed);

        // The second delivery is swallowed by "ON CONFLICT DO NOTHING" - no failed consume in MassTransit.
        App.Logs.GetSnapshot()
            .Where(r => r.Level >= LogLevel.Error && r.Category?.StartsWith("MassTransit", StringComparison.Ordinal) == true)
            .ShouldBeEmpty();
    }
}
