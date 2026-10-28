using Shouldly;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;
using StranglerFig.Migration.Sync;

namespace StranglerFig.IntegrationTests;

// Step 3, option A: copy legacy rows (public.orders) into the module (orders.orders) using a
// modified_at watermark. Each row goes through IOrdersApi -> ImportOrderCommand, never straight to the DbContext.
public sealed class BackgroundSyncTests(LegacyEnvironment legacy)
    : IntegrationTest(legacy, MigrationPhase.Routing, SyncStrategy.None)
{
    [Fact]
    public async Task Sync_CopiesLegacyOrdersIntoNewModule()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct, total: 42.50m);
        (await GetFromNewModuleAsync(placed.Id)).ShouldBeNull();

        SyncResult result = await SyncEverythingAsync();

        result.Inserted.ShouldBeGreaterThanOrEqualTo(1);
        (await GetFromNewModuleAsync(placed.Id)).ShouldBe(placed);
    }

    [Fact]
    public async Task Sync_FromWatermark_PicksUpLaterChanges()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);
        SyncResult firstPass = await SyncEverythingAsync();

        await Api.ShipOrderAsync(placed.Id, Ct);
        SyncResult secondPass = await SyncAsync(firstPass.SyncStartedAt);

        secondPass.Inserted.ShouldBe(0);
        secondPass.Updated.ShouldBe(1);
        (await GetFromNewModuleAsync(placed.Id))!.Status.ShouldBe("Shipped");
    }

    [Fact]
    public async Task Sync_FromWatermark_SkipsRowsThatDidNotChange()
    {
        await Api.PlaceOrderAsync(Ct);
        SyncResult firstPass = await SyncEverythingAsync();

        SyncResult secondPass = await SyncAsync(firstPass.SyncStartedAt);

        secondPass.Inserted.ShouldBe(0);
        secondPass.Updated.ShouldBe(0);
    }

    [Fact]
    public async Task Sync_RunTwiceFromScratch_IsIdempotent()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        await SyncEverythingAsync();
        SyncResult again = await SyncEverythingAsync();

        again.Inserted.ShouldBe(0);
        (await GetFromNewModuleAsync(placed.Id)).ShouldBe(placed);
    }
}

// The real Quartz job (OrderDataMigrationJob) with a short interval instead of 30 s.
public sealed class HostedSyncJobTests(LegacyEnvironment legacy)
    : IntegrationTest(legacy, MigrationPhase.Routing, SyncStrategy.BackgroundJob, TimeSpan.FromMilliseconds(200))
{
    [Fact]
    public async Task Job_EventuallyCopiesNewOrders()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        await EventuallyAsync(
            async () => await GetFromNewModuleAsync(placed.Id) is not null,
            "the job should copy the order into the new module");
    }

    [Fact]
    public async Task Job_EventuallyCopiesChanges()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);
        await Api.ShipOrderAsync(placed.Id, Ct);

        await EventuallyAsync(
            async () => (await GetFromNewModuleAsync(placed.Id))?.Status == "Shipped",
            "the job should copy the shipped status into the new module");
    }
}
