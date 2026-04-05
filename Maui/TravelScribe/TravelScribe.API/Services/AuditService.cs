using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal class AuditService : IAuditService
{
    public bool IsDescriptionStale(GeneratedDescription description, int thresholdDays = 365)
    {
        double age = (DateTime.UtcNow - description.GeneratedAt).TotalDays;
        return age > thresholdDays;
    }
}
