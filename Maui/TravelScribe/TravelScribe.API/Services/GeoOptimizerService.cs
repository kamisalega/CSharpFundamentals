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
        bool hasNaturalQuestionAnswers = DetectNaturalQuestionAnswers(descriptionContent);
        bool hasStructuredData = DetectStructuredData(descriptionContent);

        return new GeoScore
        {
            HasEntityMentions = hasEntityMentions,
            HasSpecificClaims = hasSpecificClaims,
            HasNaturalQuestionAnswers = hasNaturalQuestionAnswers,
            HasStructuredData = hasStructuredData,
            OverallScore = CalculateOverallScore(hasEntityMentions, hasSpecificClaims, hasNaturalQuestionAnswers, hasStructuredData)
        };
    }

    private static bool DetectStructuredData(string content)
    {
        string pattern = @"\b(check-in|check-out|price|capacity|per night|per person|\d{1,2}:\d{2}|[€$£]\d+)\b";
        return Regex.IsMatch(content, pattern, RegexOptions.IgnoreCase);
    }

    private static bool DetectNaturalQuestionAnswers(string content)
    {
        string pattern = @"\b(offers|features|provides|includes|located|situated)\b";
        return Regex.IsMatch(content, pattern, RegexOptions.IgnoreCase);
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

    private static double CalculateOverallScore(bool hasEntityMentions, bool hasSpecificClaims,
        bool hasNaturalQuestionAnswers, bool hasStructuredData)
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

        if (hasNaturalQuestionAnswers)
        {
            score += 0.25;
        }

        if (hasStructuredData)
        {
            score += 0.25;
        }

        return score;
    }
}