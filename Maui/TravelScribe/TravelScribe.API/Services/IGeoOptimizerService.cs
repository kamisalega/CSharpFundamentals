using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal interface IGeoOptimizerService
{
    GeoScore ScoreDescription(string descriptionContent);
}
