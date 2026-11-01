using MassTransit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Quartz;
using StranglerFig.Common.Application.Clock;
using StranglerFig.Common.Application.Data;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Infrastructure.Clock;
using StranglerFig.Common.Infrastructure.Data;
using StranglerFig.Common.Infrastructure.Outbox;

namespace StranglerFig.Common.Infrastructure;

public static class InfrastructureConfiguration
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string databaseConnectionString)
    {
        NpgsqlDataSource npgsqlDataSource = new NpgsqlDataSourceBuilder(databaseConnectionString).Build();
        services.TryAddSingleton(npgsqlDataSource);

        services.AddScoped<IDbConnectionFactory, DbConnectionFactory>();

        services.TryAddSingleton<IDateTimeProvider, DateTimeProvider>();

        services.TryAddSingleton<InsertOutboxMessagesInterceptor>();

        services.AddQuartz();

        services.AddQuartzHostedService(options => options.WaitForJobsToComplete = true);

        services.TryAddSingleton<IEventBus, EventBus.EventBus>();

        services.AddMassTransit(configure =>
        {
            configure.SetKebabCaseEndpointNameFormatter();

            configure.UsingInMemory((context, cfg) => cfg.ConfigureEndpoints(context));
        });

        return services;
    }
}
