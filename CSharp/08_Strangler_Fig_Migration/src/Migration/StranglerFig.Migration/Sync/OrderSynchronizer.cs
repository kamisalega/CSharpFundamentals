using StranglerFig.Migration.Legacy;
using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.Migration.Sync;

// SyncStartedAt is the next watermark: a zone-less UTC DateTime from the database clock.
public sealed record SyncResult(int Inserted, int Updated, DateTime SyncStartedAt);

// One pass of option A. Unlike the article's job, it doesn't write to the module's DbContext:
// every row goes through IOrdersApi, i.e. through the module's own ImportOrderCommand.
public sealed class OrderSynchronizer
{
    private readonly LegacyOrdersReader _legacyOrders;
    private readonly IOrdersApi _ordersApi;

    internal OrderSynchronizer(LegacyOrdersReader legacyOrders, IOrdersApi ordersApi)
    {
        _legacyOrders = legacyOrders;
        _ordersApi = ordersApi;
    }

    public async Task<SyncResult> SyncChangesSinceAsync(DateTime since, CancellationToken cancellationToken = default)
    {
        // Captured BEFORE the query: a row changed while this pass runs gets modified_at >= syncStartedAt,
        // so the next pass picks it up instead of losing it.
        DateTime syncStartedAt = await _legacyOrders.GetDatabaseUtcNowAsync();

        IReadOnlyList<LegacyOrderRow> changed = await _legacyOrders.GetOrdersChangedSinceAsync(since);

        int inserted = 0, updated = 0;
        foreach (LegacyOrderRow row in changed)
        {
            ImportOrderResult result = await _ordersApi.ImportOrderAsync(
                row.OrderId,
                row.CustomerEmail,
                row.Total,
                row.Status == LegacyOrderStatus.Shipped,
                LegacyOrdersClient.FromLegacyUtc(row.CreatedAt),
                cancellationToken);

            if (result == ImportOrderResult.Created)
            {
                inserted++;
            }
            else
            {
                updated++;
            }
        }

        return new SyncResult(inserted, updated, syncStartedAt);
    }
}
