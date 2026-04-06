using TravelScribe.API.Services;
using TravelScribe.Domain.Interfaces;

namespace TravelScribe.API.Extensions;

internal static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTravelScribeServices(this IServiceCollection services, Uri ollamaBaseUrl)
    {
        services.AddSingleton(ollamaBaseUrl);
        services.AddScoped<IGeoOptimizerService>(_ => new GeoOptimizerService(ollamaBaseUrl));
        services.AddScoped<IImageAnalysisService>(_ => new ImageAnalysisService(ollamaBaseUrl));
        services.AddScoped<IDescriptionGeneratorService>(_ => new DescriptionGeneratorService(ollamaBaseUrl));
        services.AddScoped<IAuthenticityGuardService>(_ => new AuthenticityGuardService(ollamaBaseUrl));
        services.AddScoped<ITranslationService>(_ => new TranslationService(ollamaBaseUrl));
        services.AddScoped<IAuditService, AuditService>();
        return services;
    }
}
