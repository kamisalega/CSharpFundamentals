using Microsoft.Extensions.Options;
using Quartz;

namespace StranglerFig.Migration.Sync;

internal sealed class ConfigureOrderDataMigrationJob(IOptions<OrdersMigrationOptions> options) : IConfigureOptions<QuartzOptions>
{
    private readonly OrdersMigrationOptions _options = options.Value;

    public void Configure(QuartzOptions options)
    {
        string jobName = typeof(OrderDataMigrationJob).FullName!;

        options
            .AddJob<OrderDataMigrationJob>(configure => configure.WithIdentity(jobName))
            .AddTrigger(configure =>
                configure
                    .ForJob(jobName)
                    .WithSimpleSchedule(schedule => schedule.WithInterval(_options.SyncInterval).RepeatForever()));
    }
}
