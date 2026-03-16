namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record EventDto(
    Guid Id,
    Guid CategoryId,
    string Title,
    string Description,
    string Location,
    DateTime StartsAtUtc,
    DateTime? EndsAtUtc,
    string Status,
    IReadOnlyList<TicketTypeDto> TicketTypes);
public sealed record TicketTypeDto(
    Guid TicketTypeId,
    string Name,
    decimal Price,
    string Currency,
    decimal Quantity);
