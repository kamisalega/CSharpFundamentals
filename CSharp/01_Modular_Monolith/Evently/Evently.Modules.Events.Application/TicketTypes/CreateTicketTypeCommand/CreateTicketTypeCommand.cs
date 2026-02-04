using Evently.Modules.Events.Application.Abstractions.Messaging;

namespace Evently.Modules.Events.Application.TicketTypes.CreateTicketTypeCommand;

public sealed record CreateTicketTypeCommand(
    Guid EventId,
    string Name,
    decimal Price,
    string Currency,
    decimal Quantity) : ICommand<Guid>;
