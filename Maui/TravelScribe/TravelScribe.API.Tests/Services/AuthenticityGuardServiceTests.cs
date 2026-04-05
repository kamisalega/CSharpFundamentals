using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;

public sealed class AuthenticityGuardServiceTests : IDisposable
{
    private const string OllamaBaseUrl = "http://192.168.1.15:11434";
    private readonly AuthenticityGuardService _sut = new AuthenticityGuardService(new Uri(OllamaBaseUrl));

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Validate_HonestDescription_ReturnsAuthentic()
    {
        // Arrange
        var description = new GeneratedDescription
        {
            Content = "A small family-run hotel with 10 rooms and a garden. Located in a quiet residential area."
        };
        var photos = new List<PropertyPhoto>
        {
            new() { DetectedTags = ["small building", "garden", "residential street"] }
        };

        // Act
        (bool isAuthentic, _) = await _sut.ValidateDescriptionAsync(description, photos);

        // Assert
        isAuthentic.ShouldBeTrue();
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Validate_ExaggeratedDescription_ReturnsFalseWithNotes()
    {
        // Arrange
        var description = new GeneratedDescription
        {
            Content =
                "The most luxurious 5-star resort with world-class spa, Michelin-starred restaurant, and private beach access.An unparalleled paradise of ultimate luxury."
        };
        var photos = new List<PropertyPhoto>
        {
            new() { DetectedTags = ["small room", "basic furniture", "parking lot"] }
        };

        // Act
        (bool isAuthentic, string? notes) = await _sut.ValidateDescriptionAsync(description, photos);

        // Assert
        isAuthentic.ShouldBeFalse();
        notes.ShouldNotBeNullOrWhiteSpace();
    }

    public void Dispose()
    {
        _sut.Dispose();
    }
}
