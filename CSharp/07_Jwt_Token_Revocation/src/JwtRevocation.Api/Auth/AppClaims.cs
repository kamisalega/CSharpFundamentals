namespace JwtRevocation.Api.Auth;

public static class AppClaims
{
    public const string TokenVersion = "token_version";

    // Session id = refresh token FamilyId.
    public const string SessionId = "sid";
}
