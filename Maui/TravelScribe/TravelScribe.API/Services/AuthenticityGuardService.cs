using System.Text;
using OllamaSharp;
using OllamaSharp.Models;
using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal class AuthenticityGuardService(Uri ollamaUri) : IAuthenticityGuardService
{
    private readonly OllamaApiClient _ollama = new OllamaApiClient(ollamaUri);


    public async Task<(bool IsAuthentic, string? Notes)> ValidateDescriptionAsync(
        GeneratedDescription description,
        List<PropertyPhoto> sourcePhotos)
    {
       
        _ollama.SelectedModel = "llama3.1:8b";

        IEnumerable<string> tags = sourcePhotos
            .SelectMany(p => p.DetectedTags)
            .Distinct();

        string prompt = $"""
                         You are an authenticity validator for travel property descriptions.
                         Your job is to detect exaggeration, false claims, and misleading language.

                         Property description:
                         "{description.Content}"

                         Features actually visible in photos: {string.Join(", ", tags)}

                         Rules:
                         - Compare the description against the photo evidence
                         - Flag any claims not supported by the photos
                         - Flag superlatives without evidence ("best", "most luxurious", "world-class")
                         - Flag star ratings or awards not evidenced

                         Respond in exactly this format:
                         AUTHENTIC: true or false
                         NOTES: your explanation (one paragraph)
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

        string response = sb.ToString();
        bool isAuthentic = response.Contains("AUTHENTIC: true", StringComparison.OrdinalIgnoreCase);
        string? notes = ExtractNotes(response);

        return (isAuthentic, notes);
    }

    private static string? ExtractNotes(string response)
    {
        int notesIndex = response.IndexOf("NOTES:", StringComparison.OrdinalIgnoreCase);
        if (notesIndex < 0)
        {
            return null;
        }

        return response[(notesIndex + 6)..].Trim();
    }

    public void Dispose()
    {
        _ollama.Dispose();
    }
}
