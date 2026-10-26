using System.Net;
using JwtRevocation.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace JwtRevocation.Api.IntegrationTests;

// Step 2 from the article: the access token is still cryptographically valid and not expired,
// but OnTokenValidated compares its token_version claim with the database and rejects it.
public sealed class TokenVersionTests(ApiFactory factory) : IntegrationTest(factory)
{
    [Fact]
    public async Task LogoutAll_RejectsEveryAccessTokenImmediately()
    {
        var user = await Api.RegisterAsync(Ct);
        var laptop = await Api.LoginAsync(user, Ct);
        var phone = await Api.LoginAsync(user, Ct);

        (await Api.LogoutAllAsync(laptop.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Api.GetMeAsync(laptop.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.GetMeAsync(phone.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task LogoutAll_DeletesEveryRefreshToken()
    {
        var user = await Api.RegisterAsync(Ct);
        var laptop = await Api.LoginAsync(user, Ct);
        var phone = await Api.LoginAsync(user, Ct);

        await Api.LogoutAllAsync(laptop.AccessToken, Ct);

        (await Api.RefreshAsync(laptop.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.RefreshAsync(phone.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task LogoutAll_IncrementsVersion_SoNewLoginGetsTokenWithNewVersion()
    {
        var (user, tokens) = await Api.RegisterAndLoginAsync(Ct);

        await Api.LogoutAllAsync(tokens.AccessToken, Ct);
        var fresh = await Api.LoginAsync(user, Ct);

        var me = await Api.GetMeOrThrowAsync(fresh.AccessToken, Ct);
        me.TokenVersion.ShouldBe(1);
    }

    [Fact]
    public async Task ChangePassword_RevokesOldTokens_AndOnlyNewPasswordWorks()
    {
        var (user, tokens) = await Api.RegisterAndLoginAsync(Ct);
        const string newPassword = "N3w-Pa$$w0rd";

        (await Api.ChangePasswordAsync(tokens.AccessToken, user.Password, newPassword, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.RefreshAsync(tokens.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.TryLoginAsync(user.Email, user.Password, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var fresh = await Api.LoginAsync(user with { Password = newPassword }, Ct);
        (await Api.GetMeAsync(fresh.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_KeepsTokensValid()
    {
        var (_, tokens) = await Api.RegisterAndLoginAsync(Ct);

        (await Api.ChangePasswordAsync(tokens.AccessToken, "wrong-password", "whatever-123", Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task VersionBumpedDirectlyInDatabase_RejectsToken()
    {
        // Shows that the check really reads the database on every request - nothing is cached in the token.
        var (user, tokens) = await Api.RegisterAndLoginAsync(Ct);
        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        await WithDbAsync(db => db.Users
            .Where(u => u.Email == user.Email)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1), Ct));

        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeactivatedUser_IsRejectedImmediately()
    {
        var (user, tokens) = await Api.RegisterAndLoginAsync(Ct);

        // Simulates an admin deactivating the account.
        await WithDbAsync(db => db.Users
            .Where(u => u.Email == user.Email)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false), Ct));

        (await Api.GetMeAsync(tokens.AccessToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.RefreshAsync(tokens.RefreshToken, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Api.TryLoginAsync(user.Email, user.Password, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
