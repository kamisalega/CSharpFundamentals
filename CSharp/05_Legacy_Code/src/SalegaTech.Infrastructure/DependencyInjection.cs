using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SalegaTech.Application.Abstractions;
using SalegaTech.Domain.Interfaces;
using SalegaTech.Infrastructure.Database;
using SalegaTech.Infrastructure.Financings;
using SalegaTech.Infrastructure.Store;
using StackExchange.Redis;

namespace SalegaTech.Infrastructure;

public static class DependencyInjection
{

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var redisConnectionString = configuration.GetConnectionString("Redis") ?? "localhost:6379";
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var config = ConfigurationOptions.Parse(redisConnectionString);
            config.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(config);
        });

        services.AddScoped<ISimulationResultStore, RedisSimulationResultStore>();
        // Modern DB
        var modernConn = configuration.GetConnectionString("ModernDb")
                         ?? throw new InvalidOperationException("Missing ConnectionStrings:ModernDb");
        services.AddDbContext<ModernDbContext>(opt => opt.UseSqlite(modernConn));
        services.AddScoped<IModernSimulationRepository, ModernSimulationRepository>();

        return services;
    }

    
    public static IServiceCollection AddInfrastructureInMemory(
        this IServiceCollection services)
    {
        services.AddSingleton<ISimulationResultStore, InMemorySimulationResultStore>();

        return services;
    }
}