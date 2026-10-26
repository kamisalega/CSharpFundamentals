using System.Net.Http.Headers;
using System.Net.Http.Json;
using JwtRevocation.Api.Auth;
using JwtRevocation.Api.Endpoints;

namespace JwtRevocation.Api.IntegrationTests.Infrastructure;

public sealed record TestUser(string Email, string Password);

// Thin wrapper over the HTTP endpoints so the tests read like the scenarios from the article.
public sealed class AuthApi(HttpClient client)
{
    public async Task<TestUser> RegisterAsync(CancellationToken ct)
    {
        var user = new TestUser($"user-{Guid.NewGuid():N}@test.local", "Pa$$w0rd-1");

        var response = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(user.Email, user.Password), ct);
        response.EnsureSuccessStatusCode();

        return user;
    }

    public Task<HttpResponseMessage> TryLoginAsync(string email, string password, CancellationToken ct) =>
        client.PostAsJsonAsync("/auth/login", new LoginRequest(email, password), ct);

    public async Task<AuthTokens> LoginAsync(TestUser user, CancellationToken ct)
    {
        var response = await TryLoginAsync(user.Email, user.Password, ct);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<AuthTokens>(ct))!;
    }

    public async Task<(TestUser User, AuthTokens Tokens)> RegisterAndLoginAsync(CancellationToken ct)
    {
        var user = await RegisterAsync(ct);

        return (user, await LoginAsync(user, ct));
    }

    public Task<HttpResponseMessage> RefreshAsync(string refreshToken, CancellationToken ct) =>
        client.PostAsJsonAsync("/auth/refresh", new RefreshRequest(refreshToken), ct);

    public Task<HttpResponseMessage> GetMeAsync(string accessToken, CancellationToken ct) =>
        SendAsync(HttpMethod.Get, "/me", accessToken, body: null, ct);

    public async Task<MeResponse> GetMeOrThrowAsync(string accessToken, CancellationToken ct)
    {
        var response = await GetMeAsync(accessToken, ct);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<MeResponse>(ct))!;
    }

    public Task<HttpResponseMessage> LogoutAsync(string accessToken, CancellationToken ct) =>
        SendAsync(HttpMethod.Post, "/auth/logout", accessToken, body: null, ct);

    public Task<HttpResponseMessage> LogoutAllAsync(string accessToken, CancellationToken ct) =>
        SendAsync(HttpMethod.Post, "/auth/logout-all", accessToken, body: null, ct);

    public Task<HttpResponseMessage> ChangePasswordAsync(string accessToken, string currentPassword, string newPassword, CancellationToken ct) =>
        SendAsync(HttpMethod.Post, "/auth/change-password", accessToken, new ChangePasswordRequest(currentPassword, newPassword), ct);

    private Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, string accessToken, object? body, CancellationToken ct)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = body is null ? null : JsonContent.Create(body)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        return client.SendAsync(request, ct);
    }
}
