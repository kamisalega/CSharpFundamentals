using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;

public class TranslationServiceTests : IDisposable
{
    private const string OllamaBaseUrl = "http://192.168.1.15:11434";
    private readonly TranslationService _sut = new TranslationService(new Uri(OllamaBaseUrl));

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Translate_EnglishToFrench_ReturnsContentInFrench()
    {
        // Arrange
        var source = new GeneratedDescription
        {
            Id = Guid.NewGuid(),
            PropertyId = Guid.NewGuid(),
            Language = Language.English,
            Content = "A charming hotel with 10 rooms located near the beach. The property offers free parking and breakfast.",
            Version = 1
        };

        // Act
        GeneratedDescription result = await _sut.TranslateAsync(source, Language.French);

        // Assert
        result.Language.ShouldBe(Language.French);
        result.Content.ShouldNotBeNullOrWhiteSpace();
        result.PropertyId.ShouldBe(source.PropertyId);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task TranslateToAll_Returns7Translations()
    {
        // Arrange
        var source = new GeneratedDescription
        {
            Id = Guid.NewGuid(),
            PropertyId = Guid.NewGuid(),
            Language = Language.English,
            Content = "A small hotel with a garden and pool.",
            Version = 1
        };

        // Act
        List<GeneratedDescription> results = await _sut.TranslateToAllLanguagesAsync(source);

        // Assert
        results.Count.ShouldBe(7);
        results.ShouldAllBe(r => !string.IsNullOrWhiteSpace(r.Content));
        results.Select(r => r.Language).ShouldBeUnique();
        results.ShouldNotContain(r => r.Language == Language.English);
    }

    public void Dispose()
    {
        _sut.Dispose();
    }
}
