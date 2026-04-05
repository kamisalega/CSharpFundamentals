using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;

public interface IAuditService
{
    bool IsDescriptionStale(GeneratedDescription description, int thresholdDays = 365);
}
