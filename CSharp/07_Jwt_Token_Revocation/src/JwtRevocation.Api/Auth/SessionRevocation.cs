using JwtRevocation.Api.Database;
using Microsoft.EntityFrameworkCore;

namespace JwtRevocation.Api.Auth;

public static class SessionRevocation
{
    // Logout on one device: delete its family. The "sid" check rejects its access token right away,
    // other devices keep working.
    public static Task RevokeSessionAsync(AppDbContext db, Guid familyId, CancellationToken ct) =>
        db.RefreshTokens.Where(t => t.FamilyId == familyId).ExecuteDeleteAsync(ct);

    // Password change / sign out everywhere: delete every refresh token and bump the version,
    // so every access token already issued fails the version check.
    public static async Task RevokeAllSessionsAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        await db.RefreshTokens.Where(t => t.UserId == userId).ExecuteDeleteAsync(ct);

        await db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1), ct);
    }

    // Refresh token reuse = theft: kill the family and bump the version.
    public static async Task RevokeStolenFamilyAsync(AppDbContext db, Guid userId, Guid familyId, CancellationToken ct)
    {
        await RevokeSessionAsync(db, familyId, ct);

        await db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1), ct);
    }
}
