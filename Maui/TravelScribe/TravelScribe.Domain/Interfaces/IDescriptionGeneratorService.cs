using System.Runtime.CompilerServices;
using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;

public interface IDescriptionGeneratorService : IDisposable
{
    Task<GeneratedDescription> GenerateDescriptionAsync(
        Property property,
        List<PropertyPhoto> analyzedPhotos,
        Language language);
}
