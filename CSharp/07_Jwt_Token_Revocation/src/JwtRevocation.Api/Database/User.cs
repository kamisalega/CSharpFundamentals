namespace JwtRevocation.Api.Database;

public sealed class User
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public string Email { get; init; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    // Copied into every access token as the "token_version" claim.
    // Incrementing it makes every access token issued before the change invalid immediately.
    public int TokenVersion { get; set; }
}
