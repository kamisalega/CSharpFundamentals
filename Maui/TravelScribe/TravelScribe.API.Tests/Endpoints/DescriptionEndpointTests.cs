using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Endpoints;

public sealed class DescriptionEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public DescriptionEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }


    [Fact]
    [Trait("Category", "Integration")]
    public async Task FullPipeline_CreateProperty_GenerateDescription_ScoreGeo()
    {
        // Arrange — create property
        var property = new Property
        {
            Name = "Hotel Bella Vista",
            PropertyType = "Hotel",
            Address = "Rome, Italy",
            Photos =
            [
                new()
                {
                    DetectedTags = ["pool", "terrace", "city view", "restaurant"],
                    SceneDescription = "Rooftop terrace with pool overlooking the city"
                }
            ]
        };
        HttpResponseMessage createResponse = await _client.PostAsJsonAsync("/properties", property);
        Property created = await createResponse.Content.ReadFromJsonAsync<Property>();

        // Act — generate description
        HttpResponseMessage descResponse = await _client.PostAsync(
            $"/properties/{created!.Id}/generate-description?language=English", null);

        // Assert — description generated
        descResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        GeneratedDescription description = (await descResponse.Content.ReadFromJsonAsync<GeneratedDescription>())!;
        description.Content.ShouldNotBeNullOrWhiteSpace();

        // Act — score GEO
        HttpResponseMessage scoreResponse = await _client.PostAsync(
            $"/properties/{created.Id}/score-description", null);

        // Assert — score returned
        scoreResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        GeoScore score = (await scoreResponse.Content.ReadFromJsonAsync<GeoScore>())!;
        score.OverallScore.ShouldBeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Audit_PropertyWithNoDescription_ReturnsStale()
    {
        // Arrange
        var property = new Property
        {
            Name = "Abandoned Hotel",
            PropertyType = "Hotel",
            Address = "Nowhere"
        };
        HttpResponseMessage createResponse = await _client.PostAsJsonAsync("/properties", property);
        Property created = (await createResponse.Content.ReadFromJsonAsync<Property>())!;

        // Act
        HttpResponseMessage auditResponse = await _client.PostAsync($"/properties/{created.Id}/audit", null);

        // Assert
        auditResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        DescriptionAudit audit = (await auditResponse.Content.ReadFromJsonAsync<DescriptionAudit>())!;
        audit.IsStale.ShouldBeTrue();
        audit.StaleReasons.ShouldNotBeEmpty();
    }

    [Fact]
    public async Task GetProperty_AfterCreate_ReturnsProperty()
    {
        // Arrange
        var property = new Property
        {
            Name = "Hotel Roundtrip",
            PropertyType = "B&B",
            Address = "Amsterdam, Netherlands"
        };
        HttpResponseMessage createResponse = await _client.PostAsJsonAsync("/properties", property);
        Property created = (await createResponse.Content.ReadFromJsonAsync<Property>())!;

        // Act
        HttpResponseMessage
            getResponse = await _client.GetAsync($"/properties/{created.Id}");

        // Assert
        getResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        Property fetched = (await getResponse.Content.ReadFromJsonAsync<Property>())!;
        fetched.Name.ShouldBe("Hotel Roundtrip");
        fetched.PropertyType.ShouldBe("B&B");
    }
}
