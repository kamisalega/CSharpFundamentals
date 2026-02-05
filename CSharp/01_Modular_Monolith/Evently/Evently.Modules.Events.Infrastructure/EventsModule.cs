using Evently.Common.Application.Clock;
using Evently.Common.Application.Data;
using Evently.Modules.Events.Application.Abstractions.Data;
using Evently.Modules.Events.Domain.Categories;
using Evently.Modules.Events.Domain.Events;
using Evently.Modules.Events.Domain.TicketTypes;
using Evently.Modules.Events.Infrastructure.Categories;
using Evently.Modules.Events.Infrastructure.Database;
using Evently.Modules.Events.Infrastructure.Events;
using Evently.Modules.Events.Infrastructure.TicketTypes;
using Evently.Modules.Events.Presentation.Categories;
using Evently.Modules.Events.Presentation.Events;
using Evently.Modules.Events.Presentation.TicketTypes;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace Evently.Modules.Events.Infrastructure;

public static class EventsModule
{
    public static void MapsEndpoints(IEndpointRouteBuilder app)
    {
        TicketTypeEndpoints.MapEndpoints(app);
        CategoryEndpoints.MapEndpoints(app);
        EventEndpoints.MapEndpoints(app);
    }

    public static IServiceCollection AddEventsModule(this IServiceCollection services, IConfiguration configuration)
    {

        services.AddInfrastructure(configuration);

        return services;
    }

    private static void AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        string databaseConnectionString = configuration.GetConnectionString("Database")!;

        services.AddDbContext<EventsDBContext>(options => options.UseNpgsql(databaseConnectionString,
                npgsqlOptions =>
                    npgsqlOptions.MigrationsHistoryTable(HistoryRepository.DefaultTableName, Schemas.Events))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<IEventRepository, EventsRepository>();
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<EventsDBContext>());
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ITicketTypeRepository, TicketTypeRepository>();
    }
}
