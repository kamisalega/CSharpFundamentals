using TravelScribe.Domain.Models;

namespace TravelScribe.Domain.Interfaces;
public interface IImageAnalysisService : IDisposable
{
    Task<PropertyPhoto> AnalyzeImageAsync(byte[] imageData, string fileName);
    Task<List<string>> ExtractTagsAsync(byte[] imageData);
}