using System.Text;
using OllamaSharp;
using OllamaSharp.Models;
using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal class DescriptionGeneratorService(Uri ollamaUri) : IDescriptionGeneratorService
{
    private readonly OllamaApiClient _ollama = new OllamaApiClient(ollamaUri);

    public async Task<GeneratedDescription> GenerateDescriptionAsync(
        Property property,
        List<PropertyPhoto> analyzedPhotos,
        Language language)
    {

        _ollama.SelectedModel = "llama3.1:8b";

        IEnumerable<string> tags = analyzedPhotos
            .SelectMany(p => p.DetectedTags)
            .Distinct();

        string prompt = $"""
                         Generate a property description for a {property.PropertyType} called "{property.Name}"
                         located in {property.Address}.

                         Visible features from photos: {string.Join(", ", tags)}.

                         Rules:
                         - Write in {language}
                         - Be honest and authentic, do not exaggerate
                         - Include specific, verifiable facts
                         - Make it suitable for travel listing platforms
                         - Keep it between 3-5 sentences
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

        return new GeneratedDescription
        {
            Id = Guid.NewGuid(),
            PropertyId = property.Id,
            Language = language,
            Content = sb.ToString(),
            GeneratedAt = DateTime.UtcNow,
            Version = 1
        };
    }

    public void Dispose()
    {
        _ollama.Dispose();
    }
}
