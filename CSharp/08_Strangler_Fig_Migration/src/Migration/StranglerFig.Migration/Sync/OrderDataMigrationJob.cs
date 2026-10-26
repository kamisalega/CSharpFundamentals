using Microsoft.Extensions.Logging;
using Quartz;

namespace StranglerFig.Migration.Sync;

// The article's BackgroundService as a Quartz job, like every background job in Evently.
// The watermark lives in the job's data map - in memory, as the article's _lastSync field.
[DisallowConcurrentExecution]
[PersistJobDataAfterExecution]
internal sealed class OrderDataMigrationJob(OrderSynchronizer synchronizer, ILogger<OrderDataMigrationJob> logger) : IJob
{
    private const string WatermarkKey = "watermark-ticks";

    public async Task Execute(IJobExecutionContext context)
    {
        JobDataMap data = context.JobDetail.JobDataMap;
        // Unspecified on purpose: legacy's modified_at is "timestamp without time zone" holding UTC.
        DateTime since = data.ContainsKey(WatermarkKey)
            ? new DateTime(data.GetLong(WatermarkKey), DateTimeKind.Unspecified)
            : DateTime.MinValue;

        try
        {
            SyncResult result = await synchronizer.SyncChangesSinceAsync(since, context.CancellationToken);

            data[WatermarkKey] = result.SyncStartedAt.Ticks;

            logger.LogInformation("Order sync: {Inserted} inserted, {Updated} updated", result.Inserted, result.Updated);
        }
        catch (Exception exception)
        {
            // The watermark is not moved, so the next run retries the same rows.
            logger.LogError(exception, "Order sync failed");
        }
    }
}
