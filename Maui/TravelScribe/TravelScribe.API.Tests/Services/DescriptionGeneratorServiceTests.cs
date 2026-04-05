using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;

public sealed class DescriptionGeneratorServiceTests : IDisposable
{
    private const string OllamaBaseUrl = "http://192.168.1.15:11434";
    private readonly DescriptionGeneratorService _sut = new DescriptionGeneratorService(new Uri(OllamaBaseUrl));

    [Fact]
    [Trait("Category", "Integration")]
    public async Task GenerateDescription_WithAnalyzedPhotos_ReturnsDescription()
    {
        // Arrange
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Hotel Aurora",
            PropertyType = "Hotel",
            Address = "Barcelona, Spain"
        };
        var photos = new List<PropertyPhoto>
        {
            new()
            {
                DetectedTags = ["pool", "garden", "sea view", "modern furniture"],
                SceneDescription = "A luxurious hotel pool area with garden and sea view"
            }
        };

        // Act
        GeneratedDescription result = await _sut.GenerateDescriptionAsync(property, photos, Language.English);

        // Assert
        result.Content.ShouldNotBeNullOrWhiteSpace();
        result.PropertyId.ShouldBe(property.Id);
        result.Language.ShouldBe(Language.English);
    }


    [Fact]
    [Trait("Category", "Integration")]
    public async Task GenerateDescription_IncludesPropertyName()
    {
        // Arrange
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Villa Mediterra",
            PropertyType = "Villa",
            Address = "Nice, France"
        };
        var photos = new List<PropertyPhoto>
        {
            new()
            {
                DetectedTags = ["terrace", "olive trees", "swimming pool"],
            }
        };

        // Act
        GeneratedDescription result = await _sut.GenerateDescriptionAsync(property, photos, Language.English);

        // Assert
        result.Content.ShouldContain("Villa Mediterra", Case.Insensitive);
    }

    public void Dispose()
    {
        _sut.Dispose();
    }
}
