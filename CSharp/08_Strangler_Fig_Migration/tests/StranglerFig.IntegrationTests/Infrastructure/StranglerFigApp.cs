using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace StranglerFig.IntegrationTests.Infrastructure;

public sealed class StranglerFigApp(LegacyEnvironment environment) : WebApplicationFactory<Program>
{
    private readonly FeatureFlagsSource _flags = new();

    public void SetFlag(string flag, bool enabled) => _flags.SetFlag(flag, enabled);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Read once at startup.
        builder.UseSetting("ConnectionStrings:Database", environment.ConnectionString);
        builder.UseSetting("Legacy:BaseUrl", environment.LegacyBaseUrl.ToString());

        // Read on every request (the feature flag).
        builder.ConfigureAppConfiguration((_, config) => config.Add(_flags));
    }
}
