using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StranglerFig.Modules.Orders.Application.Abstractions.Data;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.Infrastructure.Database;
using StranglerFig.Modules.Orders.Infrastructure.Orders;
using StranglerFig.Modules.Orders.Infrastructure.PublicApi;
using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.Modules.Orders.Infrastructure;

public static class OrdersModule
{
    public static IServiceCollection AddOrdersModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddInfrastructure(configuration);

        return services;
    }

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
    }
}
