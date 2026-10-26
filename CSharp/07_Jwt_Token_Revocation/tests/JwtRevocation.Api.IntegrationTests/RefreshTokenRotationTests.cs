using System.Net;
using System.Net.Http.Json;
using JwtRevocation.Api.Auth;
using JwtRevocation.Api.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Shouldly;

namespace JwtRevocation.Api.IntegrationTests;

// Step 1 from the article: short access tokens + rotated refresh tokens grouped in families.
public sealed class RefreshTokenRotationTests(ApiFactory factory) : IntegrationTest(factory)
{
    [Fact]
    public async Task Refresh_ReturnsNewPair_InTheSameSession()
    {
        var (_, tokens) = await Api.RegisterAndLoginAsync(Ct);

        var response = await Api.RefreshAsync(tokens.RefreshToken, Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var rotated = (await response.Content.ReadFromJsonAsync<AuthTokens>(Ct))!;
        rotated.RefreshToken.ShouldNotBe(tokens.RefreshToken);

        var before = await Api.GetMeOrThrowAsync(tokens.AccessToken, Ct);
        var after = await Api.GetMeOrThrowAsync(rotated.AccessToken, Ct);
        after.SessionId.ShouldBe(before.SessionId);
    }

    [Fact]
    public async Task Refresh_CanBeChained()
    {
        var (_, tokens) = await Api.RegisterAndLoginAsync(Ct);

        for (var i = 0; i < 3; i++)
        {
            var response = await Api.RefreshAsync(tokens.RefreshToken, Ct);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            tokens = (await response.Content.ReadFromJsonAsync<AuthTokens>(Ct))!;
        }

        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Refresh_WithUnknownToken_ReturnsUnauthorized()
    {
        var response = await Api.RefreshAsync("not-a-real-token", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ReusedRefreshToken_IsTreatedAsTheft_AndRevokesTheWholeFamily()
    {
        var (_, original) = await Api.RegisterAndLoginAsync(Ct);

        // Legitimate client refreshes...
        var legit = (await (await Api.RefreshAsync(original.RefreshToken, Ct)).Content.ReadFromJsonAsync<AuthTokens>(Ct))!;

        // ...then an attacker replays the stolen, already used token.
        (await Api.RefreshAsync(original.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        // The whole family is gone, so even the legitimate client's latest refresh token is dead...
        (await Api.RefreshAsync(legit.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        // ...and the version bump kills access tokens that are still within their 5 minutes.
        (await Api.GetMeAsync(legit.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ReuseDetection_AlsoSignsOutOtherDevices_BecauseVersionIsBumped()
    {
        var user = await Api.RegisterAsync(Ct);
        var laptop = await Api.LoginAsync(user, Ct);
        var phone = await Api.LoginAsync(user, Ct);

        await Api.RefreshAsync(laptop.RefreshToken, Ct);
        await Api.RefreshAsync(laptop.RefreshToken, Ct);

        // Phone's family still exists, but its access token carries the old version.
        (await Api.GetMeAsync(phone.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.RefreshAsync(phone.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ConcurrentRefresh_WithSameToken_OnlyOneRequestCanClaimIt()
    {
        // The limitation from the article: two tabs refreshing at once look exactly like reuse.
        var (_, tokens) = await Api.RegisterAndLoginAsync(Ct);

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 5).Select(_ => Api.RefreshAsync(tokens.RefreshToken, Ct)));

        responses.Count(r => r.StatusCode == HttpStatusCode.OK).ShouldBe(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Unauthorized).ShouldBe(4);

        // The losers triggered reuse detection, so the winner's session is revoked as well.
        var winner = (await responses.Single(r => r.IsSuccessStatusCode).Content.ReadFromJsonAsync<AuthTokens>(Ct))!;
        (await Api.RefreshAsync(winner.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Session_HasAbsoluteExpiry_ThatRefreshingDoesNotExtend()
    {
        var time = new FakeTimeProvider(DateTimeOffset.UtcNow);
        await using var factory = Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(time)));
        var api = new AuthApi(factory.CreateClient());

        var (_, tokens) = await api.RegisterAndLoginAsync(Ct);

        // Keep refreshing every day for 13 days - each rotation works...
        for (var day = 1; day <= 13; day++)
        {
            time.Advance(TimeSpan.FromDays(1));
            var response = await api.RefreshAsync(tokens.RefreshToken, Ct);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            tokens = (await response.Content.ReadFromJsonAsync<AuthTokens>(Ct))!;
        }

        // ...but on day 14 the family expires, no matter how fresh the last refresh token is.
        time.Advance(TimeSpan.FromDays(1));
        (await api.RefreshAsync(tokens.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
