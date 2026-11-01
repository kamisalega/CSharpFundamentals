using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace StranglerFig.IntegrationTests.Infrastructure;

public sealed class StranglerFigApp(LegacyEnvironment environment) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting("Legacy:BaseUrl", environment.LegacyBaseUrl.ToString());
}
