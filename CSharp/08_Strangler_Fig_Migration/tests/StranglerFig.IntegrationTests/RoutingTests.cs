using System.Net;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;
using Shouldly;

namespace StranglerFig.IntegrationTests;

// Step 1: OrderServiceRouter + the NewOrdersModule feature flag.
// The order is placed in legacy and NOT synced, so "404" proves the new module answered.
public sealed class RoutingTests(LegacyEnvironment legacy)
    : IntegrationTest(legacy, MigrationPhase.Routing, SyncStrategy.None)
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

    [Fact]
    public async Task FlagOn_AfterSync_NewModuleReturnsTheSameOrderAsLegacy()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);
        OrderDto fromLegacy = await Api.GetOrderOrThrowAsync(placed.Id, Ct);

        await SyncEverythingAsync();
        UseNewOrdersModule();

        OrderDto fromNewModule = await Api.GetOrderOrThrowAsync(placed.Id, Ct);
        fromNewModule.ShouldBe(fromLegacy);
    }

    [Fact]
    public async Task FlippingTheFlagBack_IsAnInstantRollback_WithoutRestart()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        UseNewOrdersModule();
        (await Api.GetOrderAsync(placed.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        UseNewOrdersModule(false);
        (await Api.GetOrderAsync(placed.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
