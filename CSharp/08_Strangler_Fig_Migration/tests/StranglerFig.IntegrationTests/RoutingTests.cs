using System.Net;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration.Seam;
using Shouldly;

namespace StranglerFig.IntegrationTests;

// Step 1: OrderServiceRouter + the NewOrdersModule feature flag.
// The order is placed in legacy and NOT synced, so "404" proves the new module answered.
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

    [Fact]
    public async Task FlagOn_ReadsFromNewModule()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        UseNewOrdersModule();

        (await Api.GetOrderAsync(placed.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
