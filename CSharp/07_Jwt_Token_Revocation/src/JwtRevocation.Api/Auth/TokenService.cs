using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using JwtRevocation.Api.Database;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace JwtRevocation.Api.Auth;

public sealed record AuthTokens(string AccessToken, string RefreshToken);

public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider timeProvider)
{
    private readonly JwtOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    // New login = new family with an absolute expiry.
    public (AuthTokens Tokens, RefreshToken Entity) CreateSession(User user)
    {
        var familyId = Guid.CreateVersion7();
        var expiresAt = timeProvider.GetUtcNow().Add(_options.SessionLifetime);

        return Issue(user, familyId, expiresAt);
    }

    // Rotation stays in the same family and keeps its expiry.
    public (AuthTokens Tokens, RefreshToken Entity) Rotate(User user, RefreshToken previous) =>
        Issue(user, previous.FamilyId, previous.ExpiresAt);

    public static string Hash(string refreshToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

    private (AuthTokens Tokens, RefreshToken Entity) Issue(User user, Guid familyId, DateTimeOffset familyExpiresAt)
    {
        var refreshToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

        var entity = new RefreshToken
        {
            TokenHash = Hash(refreshToken),
            UserId = user.Id,
            FamilyId = familyId,
            ExpiresAt = familyExpiresAt
        };

        return (new AuthTokens(CreateAccessToken(user, familyId), refreshToken), entity);
    }

    private string CreateAccessToken(User user, Guid familyId)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.Add(_options.AccessTokenLifetime),
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(AppClaims.SessionId, familyId.ToString()),
                new Claim(AppClaims.TokenVersion, user.TokenVersion.ToString(), ClaimValueTypes.Integer32)
            ]),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
                SecurityAlgorithms.HmacSha256)
        };

        return _handler.CreateToken(descriptor);
    }
}
