namespace TravelScribe.Domain.Models;

public class DescriptionAudit
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public DateTime AuditedAt { get; set; }
    public int DescriptionAgeDays { get; set; }
    public bool IsStale { get; set; }
    public string? SuggestedUpdate { get; set; }
    public List<string> StaleReasons { get; set; } = new();
}