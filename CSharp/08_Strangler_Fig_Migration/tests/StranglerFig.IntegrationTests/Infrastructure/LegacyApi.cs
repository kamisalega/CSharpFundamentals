namespace StranglerFig.IntegrationTests.Infrastructure;

// Talks to the legacy app directly, bypassing the .NET 10 host - like legacy's own UI or batch jobs would.
public sealed class LegacyApi(Uri baseUrl) : IDisposable
{
    private readonly HttpClient _client = new() { BaseAddress = baseUrl };

    public Task<string> GetHealthAsync(CancellationToken ct) => _client.GetStringAsync(new Uri("/health", UriKind.Relative), ct);

    public void Dispose() => _client.Dispose();
}
