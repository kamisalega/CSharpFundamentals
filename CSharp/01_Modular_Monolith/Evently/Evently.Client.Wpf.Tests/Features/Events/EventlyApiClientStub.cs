using Evently.Client.Wpf.ApiClient;

namespace Evently.Client.Wpf.Tests.Features.Events;

public class EventlyApiClientStub : IDisposable
{
    private static readonly HttpClient _httpClient = new() { BaseAddress = new Uri("https://localhost:5001") };

    public static EventlyApiClient Create() =>
        new(_httpClient);

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
