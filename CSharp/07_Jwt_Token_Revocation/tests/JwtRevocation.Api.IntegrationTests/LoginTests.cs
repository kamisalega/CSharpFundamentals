using System.Net;
using JwtRevocation.Api.IntegrationTests.Infrastructure;
using Shouldly;

namespace JwtRevocation.Api.IntegrationTests;

public sealed class LoginTests(ApiFactory factory) : IntegrationTest(factory)
{
    [Fact]
    public async Task Login_ReturnsAccessToken_WithTokenVersionAndSessionClaims()
    {
        var (user, tokens) = await Api.RegisterAndLoginAsync(Ct);

        var me = await Api.GetMeOrThrowAsync(tokens.AccessToken, Ct);

        me.Email.ShouldBe(user.Email);
        me.TokenVersion.ShouldBe(0);
        me.SessionId.ShouldNotBe(Guid.Empty);
        tokens.RefreshToken.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task EachLogin_StartsSeparateSession()
    {
        var user = await Api.RegisterAsync(Ct);

        var laptop = await Api.LoginAsync(user, Ct);
        var phone = await Api.LoginAsync(user, Ct);

        var laptopSession = (await Api.GetMeOrThrowAsync(laptop.AccessToken, Ct)).SessionId;
        var phoneSession = (await Api.GetMeOrThrowAsync(phone.AccessToken, Ct)).SessionId;

        laptopSession.ShouldNotBe(phoneSession);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var user = await Api.RegisterAsync(Ct);

        var response = await Api.TryLoginAsync(user.Email, "wrong-password", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_ReturnsUnauthorized()
    {
        var response = await Factory.CreateClient().GetAsync("/me", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
