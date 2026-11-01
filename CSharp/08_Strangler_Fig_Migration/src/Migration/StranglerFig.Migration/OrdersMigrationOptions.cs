namespace StranglerFig.Migration;

public enum SyncStrategy
{
    None = 0,

    // Option A: Quartz job with a modified_at watermark.
    BackgroundJob = 1,

    // Option B: the write facade publishes LegacyOrderPlacedIntegrationEvent, Orders consumes it via its inbox.
    Events = 2
}

public sealed class OrdersMigrationOptions
{
    public const string SectionName = "OrdersMigration";

    public SyncStrategy SyncStrategy { get; init; } = SyncStrategy.BackgroundJob;

    public TimeSpan SyncInterval { get; init; } = TimeSpan.FromSeconds(30);
}
