namespace Evently.Modules.Events.Application.Events.GetEvent;

public sealed record EventResponse(
    Guid Id,
    Guid CategoryId,
    string Title,
    string Description,
    string Location,
    DateTime StartsAtUtc,
    DateTime? EndsAtUtc)
{
    public List<TicketTypeResponse> TicketTypes { get; } = [];
}

public sealed record TicketTypeResponse(
    Guid TicketTypeId,
    string Name,
    decimal Price,
    string Currency,
    decimal Quantity);
