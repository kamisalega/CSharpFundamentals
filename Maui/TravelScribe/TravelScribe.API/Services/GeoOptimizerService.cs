using System.Text.RegularExpressions;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal sealed class GeoOptimizerService : IGeoOptimizerService
{
    public GeoScore ScoreDescription(string descriptionContent)
    {
        if (string.IsNullOrWhiteSpace(descriptionContent))
        {
            return new GeoScore();
        }

        bool hasEntityMentions = DetectEntityMentions(descriptionContent);

        return new GeoScore
        {
            HasEntityMentions = hasEntityMentions,
            OverallScore = CalculateOverallScore(hasEntityMentions)
        };
    }

    private static bool DetectEntityMentions(string content)
    {
       
        string pattern = @"(?<![.!?]\s)[a-z,]\s+([A-Z][a-zA-Zà-ÿ]+)";
        return Regex.IsMatch(content, pattern);
    }

    private static double CalculateOverallScore(bool hasEntityMentions)
    {
        double score = 0.0;
        if (hasEntityMentions)
        {
            score += 0.25;
        }

        return score;
    }
}
