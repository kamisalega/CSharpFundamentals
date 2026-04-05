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
        bool hasSpecificClaims = DetectSpecificClaims(descriptionContent);

        return new GeoScore
        {
            HasEntityMentions = hasEntityMentions,
            HasSpecificClaims = hasSpecificClaims,
            OverallScore = CalculateOverallScore(hasEntityMentions, hasSpecificClaims)
        };
    }

    private static bool DetectEntityMentions(string content)
    {
        string pattern = @"(?<![.!?]\s)[a-z,]\s+([A-Z][a-zA-Zà-ÿ]+)";
        return Regex.IsMatch(content, pattern);
    }

    private static bool DetectSpecificClaims(string content)
    {
        string pattern = @"\d+\s*[a-zA-Z]";
        return Regex.IsMatch(content, pattern);
    }

    private static double CalculateOverallScore(bool hasEntityMentions, bool hasSpecificClaims)
    {
        double score = 0.0;
        if (hasEntityMentions)
        {
            score += 0.25;
        }

        if (hasSpecificClaims)
        {
            score += 0.25;
        }

        return score;
    }
}
