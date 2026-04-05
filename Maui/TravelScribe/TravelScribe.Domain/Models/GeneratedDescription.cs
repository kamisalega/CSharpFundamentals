namespace TravelScribe.Domain.Models;

public class GeneratedDescription
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public Language Language { get; set; }
    public string Content { get; set; } = default!;
    public GeoScore? GeoOptimization { get; set; }
    public bool AuthenticityVerified { get; set; }
    public string? AuthenticityNotes { get; set; }
    public DateTime GeneratedAt { get; set; }
    public int Version { get; set; }
}