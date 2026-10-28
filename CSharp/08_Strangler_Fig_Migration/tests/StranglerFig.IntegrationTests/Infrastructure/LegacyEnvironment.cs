using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Images;
using DotNet.Testcontainers.Networks;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(StranglerFig.IntegrationTests.Infrastructure.LegacyEnvironment))]

// The sync job reads every changed legacy row, not only the current test's rows,
// so tests run one after another to keep the database state predictable.
[assembly: Xunit.v3.Parallelization(Mode = Xunit.Sdk.ParallelMode.None)]

namespace StranglerFig.IntegrationTests.Infrastructure;

// Postgres + the .NET Framework 2.0 legacy app (Mono, built from its Dockerfile) on a shared network.
// The .NET 10 app under test runs in-process (WebApplicationFactory) and reaches both via mapped ports.
public sealed class LegacyEnvironment : IAsyncLifetime
{
    private const string PostgresAlias = "postgres";
    private const int LegacyPort = 8080;

    private readonly INetwork _network = new NetworkBuilder().Build();
    private readonly PostgreSqlContainer _postgres;
    private readonly IFutureDockerImage _legacyImage;
    private IContainer _legacy = null!;

    public LegacyEnvironment()
    {
        _postgres = new PostgreSqlBuilder("postgres:17-alpine")
            .WithNetwork(_network)
            .WithNetworkAliases(PostgresAlias)
            .Build();

        _legacyImage = new ImageFromDockerfileBuilder()
            .WithDockerfileDirectory(Path.Combine(FindRepositoryRoot(), "src", "LegacyCode", "OrdersLegacy"))
            .WithName("strangler-fig/orders-legacy:net20")
            .WithCleanUp(false)
            .Build();
    }

    public string ConnectionString => _postgres.GetConnectionString();

    public Uri LegacyBaseUrl => new($"http://{_legacy.Hostname}:{_legacy.GetMappedPublicPort(LegacyPort)}");

    public async ValueTask InitializeAsync()
    {
        await _network.CreateAsync();
        await Task.WhenAll(_postgres.StartAsync(), _legacyImage.CreateAsync());

        _legacy = new ContainerBuilder(_legacyImage)
            .WithNetwork(_network)
            .WithEnvironment(
                "LEGACY_DB",
                $"Driver={{PostgreSQL Unicode}};Server={PostgresAlias};Port=5432;Database=postgres;Uid=postgres;Pwd=postgres;")
            .WithPortBinding(LegacyPort, assignRandomHostPort: true)
            .WithWaitStrategy(Wait.ForUnixContainer()
                .UntilHttpRequestIsSucceeded(request => request.ForPort(LegacyPort).ForPath("/health")))
            .Build();

        await _legacy.StartAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _legacy.DisposeAsync();
        await _postgres.DisposeAsync();
        await _network.DisposeAsync();
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "StranglerFig.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("StranglerFig.slnx not found.");
    }
}
