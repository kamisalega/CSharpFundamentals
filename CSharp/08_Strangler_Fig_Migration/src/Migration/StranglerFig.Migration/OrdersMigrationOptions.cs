namespace StranglerFig.Migration;

public enum MigrationPhase
{
    // Step 1: the feature flag decides which implementation answers.
    Routing = 0
}

public enum SyncStrategy
{
    None = 0
}

public sealed class OrdersMigrationOptions
{
    public const string SectionName = "OrdersMigration";

    public MigrationPhase Phase { get; init; } = MigrationPhase.Routing;

    public SyncStrategy SyncStrategy { get; init; } = SyncStrategy.None;
}
