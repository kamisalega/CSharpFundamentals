namespace StranglerFig.IntegrationTests.Infrastructure;

// Every test gets its own app (own DI setup and flags) on top of the shared containers.
public abstract class IntegrationTest : IAsyncDisposable
{
    protected IntegrationTest(LegacyEnvironment legacy)
    {
        App = new StranglerFigApp(legacy);
        Api = new OrdersApi(App.CreateClient());
    }

    protected StranglerFigApp App { get; }

    protected OrdersApi Api { get; }

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask DisposeAsync()
    {
        await App.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
