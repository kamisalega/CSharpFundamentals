using Shouldly;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration.Seam;
using StranglerFig.Migration.Sync;

namespace StranglerFig.IntegrationTests;

// Step 3, option A: copy legacy rows (public.orders) into the module (orders.orders) using a
// modified_at watermark. Each row goes through IOrdersApi -> ImportOrderCommand, never straight to the DbContext.
public sealed class BackgroundSyncTests(LegacyEnvironment legacy) : IntegrationTest(legacy)
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
}
