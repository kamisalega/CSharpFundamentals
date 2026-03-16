namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record OrderDto(
    Guid Id,
    Guid CustomerId,
    string Status,
    decimal TotalPrice,
    DateTime CreatedAtUtc,
    IReadOnlyList<OrderItemDto> OrderItems);
