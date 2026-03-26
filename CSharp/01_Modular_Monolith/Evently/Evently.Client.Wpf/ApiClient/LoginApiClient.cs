using System.Net.Http;
using System.Net.Http.Json;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.ApiClient;

public sealed class LoginApiClient(HttpClient httpClient)
{
    private const string RealmName = "evently";

    public async Task<LoginResponse> LoginAsync(string email, string password, CancellationToken cancellation = default)
    {
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = "evently-public-client",
            ["username"] = email,
            ["password"] = password
        });

        HttpResponseMessage response = await httpClient.PostAsync($"realms/{RealmName}/protocol/openid-connect/token",
            content, cancellation);
        response.EnsureSuccessStatusCode();
        LoginResponse? loginResponse = await response.Content.ReadFromJsonAsync<LoginResponse>(cancellation);

        if (loginResponse is null)
        {
            throw new InvalidOperationException("Empty response from token endpoint");
        }

        return loginResponse;
    }
}
