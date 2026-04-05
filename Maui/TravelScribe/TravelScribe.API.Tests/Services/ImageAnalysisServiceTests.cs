using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;
public sealed class ImageAnalysisServiceTests : IDisposable
{
    private const string OllamaBaseUrl = "http://192.168.1.15:11434";
    private readonly ImageAnalysisService _sut = new ImageAnalysisService(new Uri(OllamaBaseUrl));


    [Fact]
    [Trait("Category", "Integration")]
    public async Task ExtractTags_WithValidImage_ReturnsNonEmptyList()
    {
        // Arrange
        byte[] imageData = await File.ReadAllBytesAsync("TestData/hotel-room.jpg");

        // Act
        List<string> tags = await _sut.ExtractTagsAsync(imageData);

        // Assert
        tags.ShouldNotBeEmpty();
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task AnalyzeImage_WithValidPhoto_ReturnsPhotoWithTags()
    {
        // Arrange
        byte[] imageData = await File.ReadAllBytesAsync("TestData/hotel-room.jpg");

        // Act
        PropertyPhoto result = await _sut.AnalyzeImageAsync(imageData, "hotel-room.jpg");

        // Assert
        result.FileName.ShouldBe("hotel-room.jpg");
        result.DetectedTags.ShouldNotBeEmpty();
        result.AnalyzedAt.ShouldNotBe(default);
        result.Id.ShouldNotBe(Guid.Empty);
    }

    public void Dispose()
    {
        _sut.Dispose();
    }
}
