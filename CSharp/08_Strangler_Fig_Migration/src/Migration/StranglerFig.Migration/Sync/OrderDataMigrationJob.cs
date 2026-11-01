using Microsoft.Extensions.Logging;
using Quartz;

namespace StranglerFig.Migration.Sync;

// The article's BackgroundService as a Quartz job, like every background job in Evently.
[DisallowConcurrentExecution]
internal sealed class OrderDataMigrationJob(OrderSynchronizer synchronizer, ILogger<OrderDataMigrationJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        try
        {
            SyncResult result = await synchronizer.SyncChangesSinceAsync(DateTime.MinValue, context.CancellationToken);

            logger.LogInformation("Order sync: {Inserted} inserted, {Updated} updated", result.Inserted, result.Updated);
        }
        catch (Exception exception)
        {
            // The next run retries the same rows.
            logger.LogError(exception, "Order sync failed");
        }
    }
}
