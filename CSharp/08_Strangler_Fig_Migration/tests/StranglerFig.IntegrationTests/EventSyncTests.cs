using Shouldly;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;

namespace StranglerFig.IntegrationTests;

// Step 3, option B: the write facade publishes an event after legacy accepted the order,
// and the Orders module imports the order when it receives it.
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
    }
}
