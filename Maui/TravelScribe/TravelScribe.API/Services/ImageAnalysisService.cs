using System.Text;
using OllamaSharp;
using OllamaSharp.Models;
using TravelScribe.Domain.Interfaces;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Services;

internal sealed class ImageAnalysisService(Uri ollamaUri) : IImageAnalysisService
{
    private readonly OllamaApiClient _ollama = new OllamaApiClient(ollamaUri);

    public async Task<PropertyPhoto> AnalyzeImageAsync(byte[] imageData, string fileName)
    {
        List<string> tags = await ExtractTagsAsync(imageData);

        return new PropertyPhoto
        {
            Id = Guid.NewGuid(),
            FileName = fileName,
            ImageData = imageData,
            DetectedTags = tags,
            AnalyzedAt = DateTime.UtcNow
        };
    }

    public async Task<List<string>> ExtractTagsAsync(byte[] imageData)
    {
        ArgumentNullException.ThrowIfNull(imageData);

        _ollama.SelectedModel = "llava:7b";

        string base64Image = Convert.ToBase64String(imageData);

        var request = new GenerateRequest()
        {
            Model = "llava:7b",
            Prompt = "List the key features visible in this hotel/property photo as comma-separated tags. " +
                     "Only output the tags, nothing else. Example: pool, garden, sea view, modern furniture",
            Images = [base64Image],
            Stream = false
        };

        IAsyncEnumerable<GenerateResponseStream?> completions = _ollama.GenerateAsync(request);
        var sb = new StringBuilder();

        await foreach (GenerateResponseStream? completion in completions)
        {
            if (completion?.Response != null)
            {
                sb.Append(completion.Response);
            }
        }

        List<string> tags = sb.ToString()
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        return tags;
    }

    public void Dispose()
    {
        _ollama.Dispose();
    }
}