using System.Net;
using JwtRevocation.Api.IntegrationTests.Infrastructure;
using Shouldly;

namespace JwtRevocation.Api.IntegrationTests;

// The "sid" extension: logout on one device must not sign out the others,
// so instead of bumping the version we delete that device's refresh token family.
public sealed class SessionTests(ApiFactory factory) : IntegrationTest(factory)
{
    [Fact]
    public async Task Logout_RejectsAccessTokenOfThatDeviceImmediately()
    {
        var (_, tokens) = await Api.RegisterAndLoginAsync(Ct);

        (await Api.LogoutAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.RefreshAsync(tokens.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_KeepsOtherDevicesSignedIn()
    {
        var user = await Api.RegisterAsync(Ct);
        var laptop = await Api.LoginAsync(user, Ct);
        var phone = await Api.LoginAsync(user, Ct);

        await Api.LogoutAsync(laptop.AccessToken, Ct);

        (await Api.GetMeAsync(phone.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Api.RefreshAsync(phone.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Logout_DoesNotChangeTokenVersion()
    {
        var user = await Api.RegisterAsync(Ct);
        var laptop = await Api.LoginAsync(user, Ct);
        var phone = await Api.LoginAsync(user, Ct);

        await Api.LogoutAsync(laptop.AccessToken, Ct);

        (await Api.GetMeOrThrowAsync(phone.AccessToken, Ct)).TokenVersion.ShouldBe(0);
    }
}
