namespace TravelScribe.Domain.Models;

public class GeoScore
{
    public double OverallScore { get; set; }
    public bool HasEntityMentions { get; set; }
    public bool HasSpecificClaims { get; set; }
    public bool HasNaturalQuestionAnswers { get; set; }
    public bool HasStructuredData { get; set; }
    public List<string> Suggestions { get; set; } = new();
}