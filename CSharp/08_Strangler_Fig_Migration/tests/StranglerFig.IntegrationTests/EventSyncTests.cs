using Shouldly;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;

namespace StranglerFig.IntegrationTests;

// Step 3, option B, the Evently way:
// facade -> IEventBus (MassTransit) -> IntegrationEventConsumer stores it in orders.inbox_messages
// -> ProcessInboxJob -> LegacyOrderPlacedIntegrationEventHandler (Presentation) -> ImportOrderCommand (Application).
public sealed class EventSyncTests(LegacyEnvironment legacy)
    : IntegrationTest(legacy, SyncStrategy.Events)
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
}
