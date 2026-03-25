using Evently.Client.Wpf.ApiClient;

namespace Evently.Client.Wpf.Tests.Features.Login;

public sealed class LoginApiClientStub : IDisposable
{
    private static readonly HttpClient _httpClient = new() { BaseAddress = new Uri("https://localhost:18080") };

    public static LoginApiClient Create() =>
        new(_httpClient);

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
