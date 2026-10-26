using System.Security.Claims;
using JwtRevocation.Api.Database;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace JwtRevocation.Api.Auth;

public static class TokenVersionCheck
{
    // Runs after the JWT handler has already validated signature, issuer, audience and lifetime.
    // This is the only place where a valid, unexpired token hits the database.
    public static async Task OnTokenValidated(TokenValidatedContext context)
    {
        var principal = context.Principal!;

        if (!Guid.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var userId) ||
            !Guid.TryParse(principal.FindFirstValue(AppClaims.SessionId), out var sessionId) ||
            !int.TryParse(principal.FindFirstValue(AppClaims.TokenVersion), out var tokenVersion))
        {
            context.Fail("Token is missing required claims.");
            return;
        }

        var services = context.HttpContext.RequestServices;
        var db = services.GetRequiredService<AppDbContext>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();

        // One round trip: user state + "does this device's refresh token family still exist".
        var state = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.IsActive,
                u.TokenVersion,
                SessionActive = db.RefreshTokens.Any(t => t.FamilyId == sessionId && t.ExpiresAt > now)
            })
            .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

        if (state is null || !state.IsActive)
        {
            context.Fail("User not found or inactive.");
            return;
        }

        if (state.TokenVersion != tokenVersion)
        {
            context.Fail("Token version is outdated.");
            return;
        }

        if (!state.SessionActive)
        {
            context.Fail("Session has been revoked.");
        }
    }
}
