namespace TravelScribe.Domain.Models;

public class PropertyPhoto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = default!;
    public byte[]? ImageData { get; set; }
    public string? ImageUrl { get; set; }
    public List<string> DetectedTags { get; set; } = new();
    public string? SceneDescription { get; set; }
    public DateTime AnalyzedAt { get; set; }
}