using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration;

// Everything here is temporary. Cutover: move the /orders endpoints into Orders.Presentation,
// delete this project, then switch the legacy app off and drop its table.
public static class OrdersMigrationRegistration
{
    public static IServiceCollection AddOrdersMigration(this IServiceCollection services, IConfiguration configuration)
    {
        // The legacy app is a separate process (.NET Framework 2.0 on Mono) - we talk to it over HTTP.
        string legacyBaseUrl = configuration["Legacy:BaseUrl"]
            ?? throw new InvalidOperationException("Missing Legacy:BaseUrl.");
        services.AddHttpClient<LegacyOrdersClient>(client => client.BaseAddress = new Uri(legacyBaseUrl.TrimEnd('/') + "/"));

        services.AddScoped<IOrderService>(sp => sp.GetRequiredService<LegacyOrdersClient>());

        services.AddEndpoints(typeof(OrdersMigrationRegistration).Assembly);

        return services;
    }
}
