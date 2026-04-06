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

    public Task<DescriptionAudit> AuditPropertyDescriptionAsync(Property property)
    {
        GeneratedDescription? latestDescription = property.Descriptions
            .OrderByDescending(d => d.GeneratedAt)
            .FirstOrDefault();

        var audit = new DescriptionAudit
        {
            Id = Guid.NewGuid(),
            PropertyId = property.Id,
            AuditedAt = DateTime.UtcNow
        };

        if (latestDescription is null)
        {
            audit.IsStale = true;
            audit.StaleReasons.Add("No description exists for this property");
            return Task.FromResult(audit);
        }

        audit.DescriptionAgeDays = (int)(DateTime.UtcNow - latestDescription.GeneratedAt).TotalDays;
        audit.IsStale = IsDescriptionStale(latestDescription);

        if (audit.IsStale)
        {
            audit.StaleReasons.Add($"Description is {audit.DescriptionAgeDays} days old");
        }

        return Task.FromResult(audit);
    }

}
