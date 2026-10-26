using StranglerFig.IntegrationTests.Infrastructure;
using Shouldly;

namespace StranglerFig.IntegrationTests;

public sealed class LegacyAppTests(LegacyEnvironment legacy)
{
    [Fact]
    public async Task LegacyApp_IsCompiledForNetFramework20()
    {
        // v2.0.50727 = CLR 2.0, i.e. .NET Framework 2.0 (2005). Mono runs it on its CLR 4 runtime.
        using var legacyApi = new LegacyApi(legacy.LegacyBaseUrl);
        string health = await legacyApi.GetHealthAsync(TestContext.Current.CancellationToken);

        health.ShouldBe("OK v2.0.50727");
    }
}
