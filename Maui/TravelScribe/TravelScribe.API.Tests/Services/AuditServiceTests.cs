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

    [Fact]
    public async Task AuditPropertyDescription_NoDescriptions_ReturnsStale()
    {
        // Arrange
        var sut = new AuditService();
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Empty Hotel"
        };

        // Act
        DescriptionAudit result = await sut.AuditPropertyDescriptionAsync(property);

        // Assert
        result.IsStale.ShouldBeTrue();
        result.StaleReasons.ShouldContain("No description exists for this property");
        result.PropertyId.ShouldBe(property.Id);
    }


    [Fact]
    public async Task AuditPropertyDescription_OldDescription_ReturnsStale()
    {
        // Arrange
        var sut = new AuditService();
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Old Hotel",
            Descriptions = new List<GeneratedDescription>
            {
                new()
                {
                    GeneratedAt = DateTime.UtcNow.AddDays(-400),
                    Content = "An old description"
                }
            }
        };

        // Act
        DescriptionAudit result = await sut.AuditPropertyDescriptionAsync(property);

        // Assert
        result.IsStale.ShouldBeTrue();
        result.DescriptionAgeDays.ShouldBeGreaterThan(365);
    }

    [Fact]
    public async Task AuditPropertyDescription_RecentDescription_ReturnsNotStale()
    {
        // Arrange
        var sut = new AuditService();
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Fresh Hotel",
            Descriptions = new List<GeneratedDescription>
            {
                new()
                {
                    GeneratedAt = DateTime.UtcNow.AddDays(-30),
                    Content = "A fresh description"
                }
            }
        };

        // Act
        DescriptionAudit result = await sut.AuditPropertyDescriptionAsync(property);

        // Assert
        result.IsStale.ShouldBeFalse();
    }
}
