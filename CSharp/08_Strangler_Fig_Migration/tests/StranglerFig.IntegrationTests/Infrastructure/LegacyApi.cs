using System.Text;

namespace StranglerFig.IntegrationTests.Infrastructure;

// Talks to the legacy app directly, bypassing the .NET 10 host - like legacy's own UI or batch jobs would.
public sealed class LegacyApi(Uri baseUrl) : IDisposable
{
    private readonly HttpClient _client = new() { BaseAddress = baseUrl };

    public Task<string> GetHealthAsync(CancellationToken ct) => _client.GetStringAsync(new Uri("/health", UriKind.Relative), ct);

    public async Task<Guid> PlaceOrderAsync(string customerEmail, decimal total, CancellationToken ct)
    {
        string xml = $"<PlaceOrderRequest><CustomerEmail>{customerEmail}</CustomerEmail><Total>{total}</Total></PlaceOrderRequest>";

        using var content = new StringContent(xml, Encoding.UTF8, "application/xml");
        HttpResponseMessage response = await _client.PostAsync(new Uri("/orders", UriKind.Relative), content, ct);
        response.EnsureSuccessStatusCode();

        string body = await response.Content.ReadAsStringAsync(ct);
        string id = body[(body.IndexOf("<Id>", StringComparison.Ordinal) + 4)..body.IndexOf("</Id>", StringComparison.Ordinal)];

        return Guid.Parse(id);
    }

    public void Dispose() => _client.Dispose();
}
