using System.Text;
using System.Text.RegularExpressions;
using OllamaSharp;
using OllamaSharp.Models;
using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal sealed class GeoOptimizerService(Uri ollamaUri) : IGeoOptimizerService
{
    private readonly OllamaApiClient _ollama = new OllamaApiClient(ollamaUri);

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

    public async Task<string> OptimizeForGeoAsync(string descriptionContent, GeoScore currentScore)
    {
        _ollama.SelectedModel = "llama3.1:8b";

        var suggestions = new List<string>();
        if (!currentScore.HasEntityMentions)
        {
            suggestions.Add("Add specific place names, landmarks, neighborhoods");
        }

        if (!currentScore.HasSpecificClaims)
        {
            suggestions.Add("Add verifiable facts: numbers, dates, distances");
        }

        if (!currentScore.HasNaturalQuestionAnswers)
        {
            suggestions.Add("Use phrases like 'offers', 'features','provides', 'located'");
        }

        if (!currentScore.HasStructuredData)
        {
            suggestions.Add("Add check-in/out times, prices, capacity");
        }

        string prompt = $"""
                         Rewrite this property description to be more visible to AI search engines (ChatGPT, Gemini, Perplexity).

                         Original: "{descriptionContent}"

                         Improvements needed:
                         {string.Join("\n", suggestions.Select(s => $"- {s}"))}

                         Rules:
                         - Keep the same honest tone, do not exaggerate
                         - Add specific, verifiable details
                         - Make sentences quotable and standalone
                         - Output only the improved description, nothing else
                         """;

        var request = new GenerateRequest
        {
            Model = "llama3.1:8b",
            Prompt = prompt,
            Stream = false
        };

        var sb = new StringBuilder();
        await foreach (GenerateResponseStream? completion in _ollama.GenerateAsync(request))
        {
            if (completion?.Response != null)
            {
                sb.Append(completion.Response);
            }
        }

        return sb.ToString().Trim();
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

    public void Dispose()
    {
        _ollama.Dispose();
    }
}


