using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;

public interface IAuthenticityGuardService : IDisposable
{
    Task<(bool IsAuthentic, string? Notes)> ValidateDescriptionAsync(
        GeneratedDescription description,
        List<PropertyPhoto> sourcePhotos);
}
