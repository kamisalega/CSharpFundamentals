namespace TravelScribe.Domain.Models;

public class Property
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string PropertyType { get; set; } = default!;
    public List<PropertyPhoto> Photos { get; set; } = new();
    public List<GeneratedDescription> Descriptions { get; set; } = new();
    public DescriptionAudit? LatestAudit { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
