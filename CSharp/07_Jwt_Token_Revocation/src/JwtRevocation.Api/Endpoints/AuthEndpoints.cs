using System.Security.Claims;
using JwtRevocation.Api.Auth;
using JwtRevocation.Api.Database;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace JwtRevocation.Api.Endpoints;

public sealed record RegisterRequest(string Email, string Password);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record MeResponse(Guid UserId, string Email, int TokenVersion, Guid SessionId);

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth");

        auth.MapPost("/register", RegisterAsync);
        auth.MapPost("/login", LoginAsync);
        auth.MapPost("/refresh", RefreshAsync);
        auth.MapPost("/logout", LogoutAsync).RequireAuthorization();
        auth.MapPost("/logout-all", LogoutAllAsync).RequireAuthorization();
        auth.MapPost("/change-password", ChangePasswordAsync).RequireAuthorization();

        app.MapGet("/me", GetMe).RequireAuthorization();

        return app;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        AppDbContext db,
        IPasswordHasher<User> passwordHasher,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest();
        }

        if (await db.Users.AnyAsync(u => u.Email == request.Email, ct))
        {
            return Results.Conflict();
        }

        var user = new User { Email = request.Email };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new { user.Id });
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        AppDbContext db,
        IPasswordHasher<User> passwordHasher,
        TokenService tokenService,
        CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == request.Email, ct);

        if (user is null || !user.IsActive ||
            passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            return Results.Unauthorized();
        }

        var (tokens, refreshToken) = tokenService.CreateSession(user);

        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync(ct);

        return Results.Ok(tokens);
    }

    private static async Task<IResult> RefreshAsync(
        RefreshRequest request,
        AppDbContext db,
        TokenService tokenService,
        TimeProvider timeProvider,
        CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow();
        var hash = TokenService.Hash(request.RefreshToken);

        var token = await db.RefreshTokens
            .AsNoTracking()
            .Include(t => t.User)
            .SingleOrDefaultAsync(t => t.TokenHash == hash, ct);

        // Unknown token covers: never issued, logged out, or family already revoked.
        if (token is null || token.ExpiresAt <= now || !token.User.IsActive)
        {
            return Results.Unauthorized();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // Atomic claim: only succeeds while UsedAt is still null. The row lock is held until commit,
        // so a concurrent request waits here and then sees UsedAt already set.
        var claimed = await db.RefreshTokens
            .Where(t => t.Id == token.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);

        if (claimed == 0)
        {
            await SessionRevocation.RevokeStolenFamilyAsync(db, token.UserId, token.FamilyId, ct);
            await transaction.CommitAsync(ct);

            return Results.Unauthorized();
        }

        var (tokens, rotated) = tokenService.Rotate(token.User, token);

        // The new token is inserted in the same transaction as the claim. Otherwise a concurrent
        // reuse detection could delete the family first and this insert would bring it back to life.
        db.RefreshTokens.Add(rotated);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return Results.Ok(tokens);
    }

    private static async Task<IResult> LogoutAsync(ClaimsPrincipal principal, AppDbContext db, CancellationToken ct)
    {
        await SessionRevocation.RevokeSessionAsync(db, GetSessionId(principal), ct);

        return Results.NoContent();
    }

    private static async Task<IResult> LogoutAllAsync(ClaimsPrincipal principal, AppDbContext db, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await SessionRevocation.RevokeAllSessionsAsync(db, GetUserId(principal), ct);
        await transaction.CommitAsync(ct);

        return Results.NoContent();
    }

    private static async Task<IResult> ChangePasswordAsync(
        ChangePasswordRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        IPasswordHasher<User> passwordHasher,
        CancellationToken ct)
    {
        var user = await db.Users.SingleAsync(u => u.Id == GetUserId(principal), ct);

        if (passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
        {
            return Results.BadRequest();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        await db.SaveChangesAsync(ct);

        await SessionRevocation.RevokeAllSessionsAsync(db, user.Id, ct);
        await transaction.CommitAsync(ct);

        return Results.NoContent();
    }

    private static MeResponse GetMe(ClaimsPrincipal principal) =>
        new(
            GetUserId(principal),
            principal.FindFirstValue(JwtRegisteredClaimNames.Email)!,
            int.Parse(principal.FindFirstValue(AppClaims.TokenVersion)!),
            GetSessionId(principal));

    private static Guid GetUserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    private static Guid GetSessionId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(AppClaims.SessionId)!);
}
