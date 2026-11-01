using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.Migration.Sync;

public sealed record SyncResult(int Inserted, int Updated, DateTime SyncStartedAt);

public sealed class OrderSynchronizer
{
    private readonly IOrdersApi _ordersApi;

    internal OrderSynchronizer(IOrdersApi ordersApi)
    {
        _ordersApi = ordersApi;
    }

    public Task<SyncResult> SyncChangesSinceAsync(DateTime since, CancellationToken cancellationToken = default) =>
        throw new NotImplementedException(_ordersApi.ToString());
}
