using System.Data.Common;
using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using StranglerFig.Common.Application.Data;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;
using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.IntegrationTests.Infrastructure;

// Every test gets its own app (own DI setup and flags) on top of the shared containers.
public abstract class IntegrationTest : IAsyncDisposable
{
    protected IntegrationTest(LegacyEnvironment legacy, MigrationPhase phase, SyncStrategy syncStrategy, TimeSpan? syncInterval = null)
    {
        App = new StranglerFigApp(legacy, phase, syncStrategy, syncInterval);
        Api = new OrdersApi(App.CreateClient());
        Legacy = new LegacyApi(legacy.LegacyBaseUrl);
    }

    protected StranglerFigApp App { get; }

    protected OrdersApi Api { get; }

    protected LegacyApi Legacy { get; }

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    protected void UseNewOrdersModule(bool enabled = true) => App.SetFlag(FeatureFlags.NewOrdersModule, enabled);

    // Reads the new module through its public API - bypassing the router and the feature flag.
    protected async Task<OrderDto?> GetFromNewModuleAsync(Guid orderId)
    {
        using IServiceScope scope = App.Services.CreateScope();
        OrderResponse? order = await scope.ServiceProvider.GetRequiredService<IOrdersApi>().GetOrderAsync(orderId, Ct);

        return order is null
            ? null
            : new OrderDto(order.Id, order.CustomerEmail, order.Total, order.Status, order.CreatedAtUtc);
    }

    // Peeks into the module's tables (outbox, inbox) to show what happens under the hood.
    protected async Task<T?> QueryModuleDatabaseAsync<T>(string sql, object parameters)
    {
        using IServiceScope scope = App.Services.CreateScope();
        await using DbConnection connection =
            await scope.ServiceProvider.GetRequiredService<IDbConnectionFactory>().OpenConnectionAsync();

        return await connection.QuerySingleOrDefaultAsync<T>(sql, parameters);
    }

    protected static async Task EventuallyAsync(Func<Task<bool>> condition, string because)
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(15);

        while (!await condition())
        {
            DateTime.UtcNow.ShouldBeLessThan(deadline, because);
            await Task.Delay(100, Ct);
        }
    }

    public async ValueTask DisposeAsync()
    {
        Legacy.Dispose();
        await App.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
