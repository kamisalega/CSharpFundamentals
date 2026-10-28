using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.FeatureManagement;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Routing;
using StranglerFig.Migration.Seam;
using StranglerFig.Migration.Sync;
using StranglerFig.Migration.Writes;

namespace StranglerFig.Migration;

// Everything here is temporary. Cutover: move the /orders endpoints into Orders.Presentation,
// delete this project, then switch the legacy app off and drop its table.
public static class OrdersMigrationRegistration
{
    public static IServiceCollection AddOrdersMigration(this IServiceCollection services, IConfiguration configuration)
    {
        IConfigurationSection section = configuration.GetSection(OrdersMigrationOptions.SectionName);
        OrdersMigrationOptions options = section.Get<OrdersMigrationOptions>() ?? new OrdersMigrationOptions();
        services.Configure<OrdersMigrationOptions>(section);

        services.AddFeatureManagement();

        // The legacy app is a separate process (.NET Framework 2.0 on Mono) - we talk to it over HTTP.
        string legacyBaseUrl = configuration["Legacy:BaseUrl"]
            ?? throw new InvalidOperationException("Missing Legacy:BaseUrl.");
        services.AddHttpClient<LegacyOrdersClient>(client => client.BaseAddress = new Uri(legacyBaseUrl.TrimEnd('/') + "/"));

        services.AddScoped<LegacyOrdersReader>();
        services.AddScoped<NewOrdersModuleService>();
        services.AddScoped<OrderWriteFacade>();
        services.AddScoped(sp => new OrderSynchronizer(
            sp.GetRequiredService<LegacyOrdersReader>(),
            sp.GetRequiredService<Modules.Orders.PublicApi.IOrdersApi>()));

        services.AddScoped<IOrderService, OrderServiceRouter>();

        if (options.SyncStrategy == SyncStrategy.BackgroundJob)
        {
            services.ConfigureOptions<ConfigureOrderDataMigrationJob>();
        }

        services.AddEndpoints(typeof(OrdersMigrationRegistration).Assembly);

        return services;
    }
}
