using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;
using TravelScribe.Domain.Models;

namespace TravelScribe.API.Tests.Endpoints;

public sealed class PropertyEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public PropertyEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PostProperty_ReturnsCreated()
    {
        // Arrange
        var property = new Property
        {
            Name = "Hotel Test",
            PropertyType = "Hotel",
            Address = "Paris, France"
        };

        // Act
        HttpResponseMessage response = await _client.PostAsJsonAsync("/properties", property);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        Property? created = await response.Content.ReadFromJsonAsync<Property>();
        created!.Name.ShouldBe("Hotel Test");
        created.Id.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public async Task GetProperties_ReturnsOk()
    {
        // Arrange & Act
        HttpResponseMessage response = await _client.GetAsync("/properties");

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetProperty_NotFound_Returns404()
    {
        // Arrange & Act
        HttpResponseMessage response = await _client.GetAsync($"/properties/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ScoreDescription_WithoutDescription_ReturnsBadRequest()
    {
        // Arrange
        var property = new Property { Name = "Hotel Empty", PropertyType = "Hotel" };
        HttpResponseMessage createResponse = await _client.PostAsJsonAsync("/properties", property);
        Property? created = await createResponse.Content.ReadFromJsonAsync<Property>();

        // Act
        HttpResponseMessage response = await _client.PostAsync($"/properties/{created!.Id}/score-description", null);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Audit_NewProperty_ReturnsStale()
    {
        // Arrange
        var property = new Property { Name = "Hotel No Desc", PropertyType = "Hotel" };
        HttpResponseMessage createResponse = await _client.PostAsJsonAsync("/properties", property);
        Property? created = await createResponse.Content.ReadFromJsonAsync<Property>();

        // Act
        HttpResponseMessage response = await _client.PostAsync($"/properties/{created!.Id}/audit", null);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        DescriptionAudit? audit = await response.Content.ReadFromJsonAsync<DescriptionAudit>();
        audit!.IsStale.ShouldBeTrue();
    }
}
