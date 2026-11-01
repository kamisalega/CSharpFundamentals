using Microsoft.Extensions.Configuration;

namespace StranglerFig.IntegrationTests.Infrastructure;

// Plays the role of Azure App Configuration / a reloaded appsettings.json:
// changes configuration at runtime and fires the reload token, without restarting the app.
public sealed class FeatureFlagsSource : IConfigurationSource
{
    private readonly FeatureFlagsProvider _provider = new();

    public IConfigurationProvider Build(IConfigurationBuilder builder) => _provider;

    public void SetFlag(string flag, bool enabled) => _provider.SetFlag(flag, enabled);

    private sealed class FeatureFlagsProvider : ConfigurationProvider
    {
        public void SetFlag(string flag, bool enabled)
        {
            Data[$"FeatureManagement:{flag}"] = enabled.ToString();
            OnReload();
        }
    }
}
