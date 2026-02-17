using Evently.Common.Domain;

namespace Evently.Modules.Events.Domain.TicketTypes;

public sealed class TicketTypeSoldOutDomainEvent(Guid ticketTypeId) : DomainEvent
{
    public Guid TicketTypeId { get; init; } = ticketTypeId;
}
