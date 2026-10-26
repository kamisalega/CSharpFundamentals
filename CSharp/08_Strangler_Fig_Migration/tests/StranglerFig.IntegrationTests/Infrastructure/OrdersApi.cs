using System.Net.Http.Json;
using StranglerFig.Migration.Endpoints;
using StranglerFig.Migration.Seam;

namespace StranglerFig.IntegrationTests.Infrastructure;

// HTTP client for the public /orders routes of the .NET 10 host.
public sealed class OrdersApi(HttpClient client)
{
    public async Task<OrderDto> PlaceOrderAsync(CancellationToken ct, decimal total = 149.99m)
    {
        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/orders",
            new PlaceOrderRequest($"customer-{Guid.NewGuid():N}@test.local", total),
            ct);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<OrderDto>(ct))!;
    }

    public async Task ShipOrderAsync(Guid orderId, CancellationToken ct)
    {
        using var content = new StringContent(string.Empty);
        HttpResponseMessage response = await client.PostAsync(new Uri($"/orders/{orderId}/ship", UriKind.Relative), content, ct);
        response.EnsureSuccessStatusCode();
    }

    public Task<HttpResponseMessage> GetOrderAsync(Guid orderId, CancellationToken ct) =>
        client.GetAsync(new Uri($"/orders/{orderId}", UriKind.Relative), ct);

    public async Task<OrderDto> GetOrderOrThrowAsync(Guid orderId, CancellationToken ct)
    {
        HttpResponseMessage response = await GetOrderAsync(orderId, ct);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<OrderDto>(ct))!;
    }
}
