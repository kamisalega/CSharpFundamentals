using System.Text;
using OllamaSharp;
using OllamaSharp.Models;
using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal sealed class TranslationService(Uri ollamaUri) : ITranslationService
{
    private readonly OllamaApiClient _ollama = new OllamaApiClient(ollamaUri);

    public async Task<GeneratedDescription> TranslateAsync(GeneratedDescription sourceDescription,
        Language targetLanguage)
    {
        _ollama.SelectedModel = "llama3.1:8b";

        string prompt = $"""
                         You are a professional translator specializing in hospitality and travel content.
                         Translate the following property description from English to {targetLanguage}.
                         Preserve all factual claims, numbers, and named entities.
                         Adapt idioms naturally — do not translate literally.
                         Maintain the same tone: professional, honest, inviting.
                         Output only the translation, nothing else.

                         {sourceDescription.Content}
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
            PropertyId = sourceDescription.PropertyId,
            Language = targetLanguage,
            Content = sb.ToString().Trim(),
            GeneratedAt = DateTime.UtcNow,
            Version = sourceDescription.Version
        };
    }

    public async Task<List<GeneratedDescription>> TranslateToAllLanguagesAsync(GeneratedDescription sourceDescription)
    {
        IEnumerable<Language> targetLanguages = Enum.GetValues<Language>()
            .Where(l => l != sourceDescription.Language);

        IEnumerable<Task<GeneratedDescription>> tasks = targetLanguages
            .Select(lang => TranslateAsync(sourceDescription, lang));

        GeneratedDescription[] results = await Task.WhenAll(tasks);
        return results.ToList();
    }

    public void Dispose()
    {
        _ollama.Dispose();
    }
}
