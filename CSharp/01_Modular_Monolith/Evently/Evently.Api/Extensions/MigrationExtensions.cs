using Evently.Modules.Events.Api.Database;
using Microsoft.EntityFrameworkCore;

namespace Evently.Api.Extensions;

internal static class MigrationExtensions
{
    internal static void ApplyMigrations(this IApplicationBuilder app)
    {
        using IServiceScope scope = app.ApplicationServices.CreateScope();
        ApplyMigration<EventsDBContext>(scope);
    }

    private static void ApplyMigration<TDBContext>(IServiceScope scope) where TDBContext : DbContext
    {
        using TDBContext context = scope.ServiceProvider.GetRequiredService<TDBContext>();

        context.Database.Migrate();
    }
}
