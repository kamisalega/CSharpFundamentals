using Microsoft.Extensions.DependencyInjection;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;
using StranglerFig.Migration.Sync;
using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.IntegrationTests.Infrastructure;

// Every test gets its own app (own DI setup and flags) on top of the shared containers.
public abstract class IntegrationTest : IAsyncDisposable
{
    protected IntegrationTest(LegacyEnvironment legacy)
    {
        App = new StranglerFigApp(legacy);
        Api = new OrdersApi(App.CreateClient());
    }

    protected StranglerFigApp App { get; }

    protected OrdersApi Api { get; }

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    protected void UseNewOrdersModule(bool enabled = true) => App.SetFlag(FeatureFlags.NewOrdersModule, enabled);

    // Runs one pass of the sync job (option A) on demand, so tests don't wait for the scheduler.
    protected async Task<SyncResult> SyncAsync(DateTime since)
    {
        using IServiceScope scope = App.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<OrderSynchronizer>().SyncChangesSinceAsync(since, Ct);
    }

    protected Task<SyncResult> SyncEverythingAsync() => SyncAsync(DateTime.MinValue);

    // Reads the new module through its public API - bypassing the router and the feature flag.
    protected async Task<OrderDto?> GetFromNewModuleAsync(Guid orderId)
    {
        using IServiceScope scope = App.Services.CreateScope();
        OrderResponse? order = await scope.ServiceProvider.GetRequiredService<IOrdersApi>().GetOrderAsync(orderId, Ct);

        return order is null
            ? null
            : new OrderDto(order.Id, order.CustomerEmail, order.Total, order.Status, order.CreatedAtUtc);
    }

    public async ValueTask DisposeAsync()
    {
        await App.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
