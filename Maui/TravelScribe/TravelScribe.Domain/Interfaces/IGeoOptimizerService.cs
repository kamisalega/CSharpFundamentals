using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

public interface IGeoOptimizerService
{
    GeoScore ScoreDescription(string descriptionContent);
}
