using System.Net.Http;
using System.Net.Http.Json;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.ApiClient;

public sealed class EventlyApiClient(HttpClient http)
{
    public async Task<SearchEventsResponse?> SearchEventsAsync(string term,
        int page,
        int pageSize,
        CancellationToken cancellation = default)
    {
        HttpResponseMessage result = await http.PutAsJsonAsync("events/search", new
        {
            SearchTerm = term,
            Page = page,
            PageSize = pageSize
        }, cancellation);

        return await result.Content.ReadFromJsonAsync<SearchEventsResponse>(cancellationToken: cancellation);
    }

    public async Task<EventDto?> GetEventAsync(Guid id,
        CancellationToken cancellation = default)
    {
        return await http.GetFromJsonAsync<EventDto>($"events/{id}", cancellation);
    }

    public async Task<CartDto?> GetCartAsync(CancellationToken cancellation = default)
    {
        return await http.GetFromJsonAsync<CartDto>("carts", cancellation);
    }

    public async Task AddToCartAsync(Guid customerId, Guid ticketTypeId, int quantity,
        CancellationToken cancellation = default)
    {
        await http.PutAsJsonAsync("carts/add", new
        {
            CustomerId = customerId,
            TicketTypeId = ticketTypeId,
            Quantity = quantity
        }, cancellation);
    }

    public async Task RemoveFromCartAsync(Guid ticketTypeId,
        CancellationToken cancellation = default)
    {
        await http.PutAsJsonAsync("carts/remove", new
        {
            TicketTypeId = ticketTypeId
        }, cancellation);
    }

    public async Task CreateOrderAsync(CancellationToken cancellation = default)
    {
        await http.PostAsync("orders", null, cancellation);
    }

    public async Task<IReadOnlyCollection<OrderDto>?> GetOrdersAsync(CancellationToken cancellation = default)
    {
        return await http.GetFromJsonAsync<IReadOnlyList<OrderDto>>("orders", cancellation);
    }

    public async Task<EventStatisticsDto?> GetEventStatisticsAsync(Guid eventId, CancellationToken cancellation = default)
    {
        return await http.GetFromJsonAsync<EventStatisticsDto>($"event-statistics/{eventId}", cancellation);
    }

    public async Task<UserResponse?> GetProfileAsync(CancellationToken cancellation = default)
    {
        return await http.GetFromJsonAsync<UserResponse>($"users/profile", cancellation);
    }
}
