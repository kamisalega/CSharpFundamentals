using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration.IntegrationEvents;
using StranglerFig.Modules.Orders.Application.Abstractions.Data;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.Infrastructure.Database;
using StranglerFig.Modules.Orders.Infrastructure.Inbox;
using StranglerFig.Modules.Orders.Infrastructure.Orders;
using StranglerFig.Modules.Orders.Infrastructure.PublicApi;
using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.Modules.Orders.Infrastructure;

public static class OrdersModule
{
    public static IServiceCollection AddOrdersModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddIntegrationEventHandlers();

        services.AddInfrastructure(configuration);

        services.AddEndpoints(Presentation.AssemblyReference.Assembly);

        return services;
    }

    public static void ConfigureConsumers(IRegistrationConfigurator registrationConfigurator) =>
        registrationConfigurator.AddConsumer<IntegrationEventConsumer<LegacyOrderPlacedIntegrationEvent>>();

    // Demo only - Evently applies EF migrations here. dotnet-ef isn't installed, so the schema is created
    // from the model; GenerateCreateScript() is safe to run only when the schema doesn't exist yet.
    public static async Task EnsureOrdersSchemaAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using IServiceScope scope = services.CreateScope();
        OrdersDbContext dbContext = scope.ServiceProvider.GetRequiredService<OrdersDbContext>();

        bool exists = await dbContext.Database
            .SqlQuery<bool>($"SELECT to_regclass('orders.orders') IS NOT NULL AS \"Value\"")
            .SingleAsync(cancellationToken);

        if (!exists)
        {
#pragma warning disable EF1002 // The script comes from our own model, not from user input.
            await dbContext.Database.ExecuteSqlRawAsync(dbContext.Database.GenerateCreateScript(), cancellationToken);
#pragma warning restore EF1002
        }
    }

    private static void AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<OrdersDbContext>(options =>
            options
                .UseNpgsql(configuration.GetConnectionString("Database"))
                .UseSnakeCaseNamingConvention());

        services.AddScoped<IOrderRepository, OrderRepository>();

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<OrdersDbContext>());

        services.AddScoped<IOrdersApi, OrdersApi>();

        services.Configure<InboxOptions>(configuration.GetSection("Orders:Inbox"));

        services.ConfigureOptions<ConfigureProcessInboxJob>();
    }

    private static void AddIntegrationEventHandlers(this IServiceCollection services)
    {
        Type[] integrationEventHandlers = Presentation.AssemblyReference.Assembly
            .GetTypes()
            .Where(t => t.IsAssignableTo(typeof(IIntegrationEventHandler)))
            .ToArray();

        foreach (Type integrationEventHandler in integrationEventHandlers)
        {
            services.TryAddScoped(integrationEventHandler);

            Type integrationEvent = integrationEventHandler
                .GetInterfaces()
                .Single(i => i.IsGenericType)
                .GetGenericArguments()
                .Single();

            Type closedIdempotentHandler =
                typeof(IdempotentIntegrationEventHandler<>).MakeGenericType(integrationEvent);

            services.Decorate(integrationEventHandler, closedIdempotentHandler);
        }
    }
}
