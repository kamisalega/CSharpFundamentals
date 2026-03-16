namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record OrderItemDto(
    Guid OrderItemId,
    Guid TicketTypeId,
    int Quantity,
    decimal UnitPrice,
    decimal Price,
    string Currency);
