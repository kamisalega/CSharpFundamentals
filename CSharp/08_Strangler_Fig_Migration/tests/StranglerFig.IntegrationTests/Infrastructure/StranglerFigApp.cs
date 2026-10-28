using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using StranglerFig.Migration;

namespace StranglerFig.IntegrationTests.Infrastructure;

public sealed class StranglerFigApp(
    LegacyEnvironment environment,
    MigrationPhase phase,
    SyncStrategy syncStrategy,
    TimeSpan? syncInterval = null) : WebApplicationFactory<Program>
{
    private readonly FeatureFlagsSource _flags = new();

    public FakeLogCollector Logs => Services.GetRequiredService<FakeLogCollector>();

    public void SetFlag(string flag, bool enabled) => _flags.SetFlag(flag, enabled);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Quartz 3 keeps its logger factory in a static field. Every test here starts its own host, so the
        // next host would log through the previous (already disposed) host's factory - and fail to start.
        Quartz.Logging.LogContext.SetCurrentLogProvider(NullLoggerFactory.Instance);

        // Read once at startup (they decide what gets registered in DI).
        builder.UseSetting("ConnectionStrings:Database", environment.ConnectionString);
        builder.UseSetting("Legacy:BaseUrl", environment.LegacyBaseUrl.ToString());
        builder.UseSetting("OrdersMigration:Phase", phase.ToString());
        builder.UseSetting("OrdersMigration:SyncStrategy", syncStrategy.ToString());
        builder.UseSetting("OrdersMigration:SyncInterval", (syncInterval ?? TimeSpan.FromSeconds(30)).ToString());

        // Read on every request (the feature flag).
        builder.ConfigureAppConfiguration((_, config) => config.Add(_flags));

        builder.ConfigureTestServices(services => services.AddFakeLogging());
    }
}
