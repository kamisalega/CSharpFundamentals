namespace JwtRevocation.Api.Database;

public sealed class RefreshToken
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    // Only the SHA-256 hash is stored, so a database leak doesn't leak usable tokens.
    public string TokenHash { get; init; } = string.Empty;

    public Guid UserId { get; init; }

    public User User { get; init; } = null!;

    // One family per login (device). Every rotated token keeps the same FamilyId,
    // which is also the "sid" claim in the access token.
    public Guid FamilyId { get; init; }

    // Absolute expiry of the whole family. Rotation copies it, so refreshing never extends the session.
    public DateTimeOffset ExpiresAt { get; init; }

    // Set once the token has been exchanged. A second exchange means the token was stolen.
    public DateTimeOffset? UsedAt { get; set; }
}
