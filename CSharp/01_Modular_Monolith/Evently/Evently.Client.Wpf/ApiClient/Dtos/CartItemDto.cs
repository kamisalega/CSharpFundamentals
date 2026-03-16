namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record CartItemDto(
    Guid TicketTypeId,
    string TicketTypeName,
    int Quantity,
    decimal UnitPrice,
    string Currency);
