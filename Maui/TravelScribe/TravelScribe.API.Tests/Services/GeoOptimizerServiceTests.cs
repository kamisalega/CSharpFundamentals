using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;

public sealed class GeoOptimizerServiceTests : IDisposable
{
    private const string OllamaBaseUrl = "http://192.168.1.15:11434";
    private readonly GeoOptimizerService _sut = new GeoOptimizerService(new Uri(OllamaBaseUrl));
    [Fact]
    public void ScoreDescription_EmptyContent_ReturnsZeroScore()
    {
        // Act
        GeoScore result = _sut.ScoreDescription("");

        // Assert
        Assert.Equal(0, result.OverallScore);
    }

    [Fact]
    public void ScoreDescription_WithEntityMentions_HasEntityMentionsIsTrue()
    {
        // Arrange
      
        string content = "Located 5 minutes from Sagrada Familia in Barcelona, near La Rambla street.";

        // Act
        GeoScore result = _sut.ScoreDescription(content);

        // Assert
        result.HasEntityMentions.ShouldBeTrue();
    }

    [Fact]
    public void ScoreDescription_WithSpecificClaims_HasSpecificClaimsIsTrue()
    {
        // Arrange
        
        string content = "Hotel has 12 rooms, built in 1923, renovated in 2022. Located 300m from the beach.";

        // Act
        GeoScore result = _sut.ScoreDescription(content);

        // Assert
        result.HasSpecificClaims.ShouldBeTrue();
    }

    [Fact]
    public void ScoreDescription_WithNaturalQuestionAnswers_HasNaturalQuestionAnswersIsTrue()
    {
        // Arrange
        string content = "Hotel Aurora offers rooftop dining with panoramic views. The property features an outdoor swimming " +
                         "pool and free parking.";

        // Act
        GeoScore result = _sut.ScoreDescription(content);

        // Assert
        result.HasNaturalQuestionAnswers.ShouldBeTrue();
    }

    [Fact]
    public void ScoreDescription_WithStructuredData_HasStructuredDataIsTrue()
    {
        // Arrange
      
        string content = "Check-in from 14:00, check-out by 11:00. Prices start at €89 per night. Capacity: 45 guests.";

        // Act
        GeoScore result = _sut.ScoreDescription(content);

        // Assert
        result.HasStructuredData.ShouldBeTrue();
    }


    [Fact]
    public void ScoreDescription_WithAllGeoElements_ReturnsFullScore()
    {
        // Arrange
        
        string content = "Hotel Aurora in Barcelona offers rooftop dining with views of Sagrada Familia. " +
                         "The property features 12 rooms, built in 1923. " +
                         "Check-in from 14:00, prices start at €89 per night.";

        // Act
        GeoScore result = _sut.ScoreDescription(content);

        // Assert
        result.OverallScore.ShouldBe(1.0);
        result.HasEntityMentions.ShouldBeTrue();
        result.HasSpecificClaims.ShouldBeTrue();
        result.HasNaturalQuestionAnswers.ShouldBeTrue();
        result.HasStructuredData.ShouldBeTrue();
    }


    [Fact]
    [Trait("Category", "Integration")]
    public async Task OptimizeForGeo_ImprovesScore()
    {
        // Arrange
       
        string weakDescription = "Nice hotel with good rooms. Great location. Lovely place to stay.";
        GeoScore initialScore = _sut.ScoreDescription(weakDescription);

        // Act
        string optimized = await _sut.OptimizeForGeoAsync(weakDescription, initialScore);
        GeoScore improvedScore = _sut.ScoreDescription(optimized);

        // Assert
        improvedScore.OverallScore.ShouldBeGreaterThan(initialScore.OverallScore);
    }

    public void Dispose()
    {
        _sut.Dispose();
    }
}
