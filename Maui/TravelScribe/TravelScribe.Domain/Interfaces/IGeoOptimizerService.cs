using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;

public interface IGeoOptimizerService : IDisposable
{
    GeoScore ScoreDescription(string descriptionContent);
    Task<string> OptimizeForGeoAsync(string descriptionContent, GeoScore currentScore);
}
