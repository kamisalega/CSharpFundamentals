using Shouldly;
using TravelScribe.API.Services;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Services;

public sealed class AuditServiceTests
{
    [Fact]
    public void IsDescriptionStale_OlderThanThreshold_ReturnsTrue()
    {
        // Arrange
        var sut = new AuditService();
        var description = new GeneratedDescription
        {
            GeneratedAt = DateTime.UtcNow.AddDays(-400)
        };

        // Act
        bool result = sut.IsDescriptionStale(description);

        // Assert
        result.ShouldBeTrue();
    }

    [Fact]
    public void IsDescriptionStale_NewerThanThreshold_ReturnsFalse()
    {
        // Arrange
        var sut = new AuditService();
        var description = new GeneratedDescription
        {
            GeneratedAt = DateTime.UtcNow.AddDays(-100)
        };

        // Act
        bool result = sut.IsDescriptionStale(description);

        // Assert
        result.ShouldBeFalse();
    }

    [Fact]
    public void IsDescriptionStale_CustomThreshold_UsesProvidedValue()
    {
        // Arrange
        var sut = new AuditService();
        var description = new GeneratedDescription
        {
            GeneratedAt = DateTime.UtcNow.AddDays(-50)
        };

        // Act
        bool result = sut.IsDescriptionStale(description, thresholdDays: 30);

        // Assert
        result.ShouldBeTrue();
    }
}
