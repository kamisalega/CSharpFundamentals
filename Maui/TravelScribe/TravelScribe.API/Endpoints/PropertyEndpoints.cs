using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Endpoints;

internal static class PropertyEndpoints
{
    internal static readonly List<Property> Properties = new();

    public static Property? FindProperty(Guid id) => Properties.Find(p => p.Id == id);

    public static void MapPropertyEndpoints(this WebApplication app)
    {
        app.MapGet("/properties", () => Results.Ok(Properties));

        app.MapGet("/properties/{id}", (Guid id) =>
        {
            Property? property = Properties.Find(p => p.Id == id);
            return property is null ? Results.NotFound() : Results.Ok(property);
        });

        app.MapPost("/properties", (Property property) =>
        {
            property.Id = Guid.NewGuid();
            property.CreatedAt = DateTime.UtcNow;
            property.UpdatedAt = DateTime.UtcNow;
            Properties.Add(property);
            return Results.Created($"/properties/{property.Id}", property);
        });

        app.MapPost("/properties/{id}/generate-description", async (
            Guid id,
            Language language,
            IDescriptionGeneratorService descriptionGenerator) =>
        {
            Property? property = Properties.Find(p => p.Id == id);
            if (property is null)
            {
                return Results.NotFound();
            }

            GeneratedDescription description = await descriptionGenerator.GenerateDescriptionAsync(
                property, property.Photos, language);

            property.Descriptions.Add(description);
            property.UpdatedAt = DateTime.UtcNow;

            return Results.Ok(description);
        });

        app.MapPost("/properties/{id}/score-description", (
            Guid id,
            IGeoOptimizerService geoOptimizer) =>
        {
            Property? property = Properties.Find(p => p.Id == id);
            if (property is null)
            {
                return Results.NotFound();
            }

            GeneratedDescription? englishDescription = property.Descriptions
                .FirstOrDefault(d => d.Language == Language.English);
            if (englishDescription is null)
            {
                return Results.BadRequest("No English description found");
            }

            GeoScore score = geoOptimizer.ScoreDescription(englishDescription.Content);
            englishDescription.GeoOptimization = score;

            return Results.Ok(score);
        });
    }
}

internal static class DescriptionEndpoints
{
    public static void MapDescriptionEndpoints(this WebApplication app)
    {
        app.MapPost("/properties/{id}/descriptions/{descId}/optimize-geo", async (
            Guid id,
            Guid descId,
            IGeoOptimizerService geoOptimizer) =>
        {
            Property? property = PropertyEndpoints.FindProperty(id);
            if (property is null)
            {
                return Results.NotFound();
            }

            GeneratedDescription? description = property.Descriptions.FirstOrDefault(d => d.Id == descId);
            if (description is null)
            {
                return Results.NotFound();
            }

            GeoScore score = geoOptimizer.ScoreDescription(description.Content);
            string optimized = await geoOptimizer.OptimizeForGeoAsync(description.Content, score);

            description.Content = optimized;
            description.GeoOptimization = geoOptimizer.ScoreDescription(optimized);
            description.Version++;

            return Results.Ok(description);
        });


        app.MapPost("/properties/{id}/descriptions/{descId}/verify-authenticity", async (
            Guid id,
            Guid descId,
            IAuthenticityGuardService authenticityGuard) =>
        {
            Property? property = PropertyEndpoints.FindProperty(id);
            if (property is null)
            {
                return Results.NotFound();
            }

            GeneratedDescription? description = property.Descriptions.FirstOrDefault(d => d.Id == descId);
            if (description is null)
            {
                return Results.NotFound();
            }

            (bool isAuthentic, string? notes) = await authenticityGuard.ValidateDescriptionAsync(
                description, property.Photos);

            description.AuthenticityVerified = isAuthentic;
            description.AuthenticityNotes = notes;

            return Results.Ok(description);
        });


        app.MapPost("/properties/{id}/translate-all", async (
            Guid id,
            ITranslationService translationService) =>
        {
            Property? property = PropertyEndpoints.FindProperty(id);
            if (property is null)
            {
                return Results.NotFound();
            }

            GeneratedDescription? englishDescription = property.Descriptions
                .FirstOrDefault(d => d.Language == Language.English);
            if (englishDescription is null)
            {
                return Results.BadRequest("No English description found");
            }

            List<GeneratedDescription> translations =
                await translationService.TranslateToAllLanguagesAsync(englishDescription);
            property.Descriptions.AddRange(translations);

            return Results.Ok(translations);
        });

        app.MapPost("/properties/{id}/audit", async (
            Guid id,
            IAuditService auditService) =>
        {
            Property? property = PropertyEndpoints.FindProperty(id);
            if (property is null)
            {
                return Results.NotFound();
            }

            DescriptionAudit audit = await auditService.AuditPropertyDescriptionAsync(property);
            property.LatestAudit = audit;

            return Results.Ok(audit);
        });
    }
}
