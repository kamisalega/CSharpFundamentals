using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration.Seam;
using Shouldly;

namespace StranglerFig.IntegrationTests;

// Step 1: a seam (IOrderService) in front of legacy. The .NET 10 host owns the public /orders routes.
public sealed class RoutingTests(LegacyEnvironment legacy) : IntegrationTest(legacy)
{
    [Fact]
    public async Task FlagOff_ReadsFromLegacy()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        OrderDto order = await Api.GetOrderOrThrowAsync(placed.Id, Ct);

        order.ShouldBe(placed);
        order.Status.ShouldBe("Pending");
    }
}
