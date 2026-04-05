using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;

public sealed class GeoOptimizerServiceTests
{
    [Fact]
    public void ScoreDescription_EmptyContent_ReturnsZeroScore()
    {
        // Arrange
        var sut = new GeoOptimizerService();

        // Act
        GeoScore result = sut.ScoreDescription("");

        // Assert
        Assert.Equal(0, result.OverallScore);
    }

    [Fact]
    public void ScoreDescription_WithEntityMentions_HasEntityMentionsIsTrue()
    {
        // Arrange
        var sut = new GeoOptimizerService();
        string content = "Located 5 minutes from Sagrada Familia in Barcelona, near La Rambla street.";

        // Act
        GeoScore result = sut.ScoreDescription(content);

        // Assert
        result.HasEntityMentions.ShouldBeTrue();
    }
}
