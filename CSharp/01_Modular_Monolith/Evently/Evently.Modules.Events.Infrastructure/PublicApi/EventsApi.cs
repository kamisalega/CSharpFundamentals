using Evently.Common.Domain;
using Evently.Modules.Events.Application.TicketTypes.GetTicketType;
using Evently.Modules.Events.PublicApi;
using MediatR;
using TicketTypeResponse = Evently.Modules.Events.PublicApi.TicketTypeResponse;

namespace Evently.Modules.Events.Infrastructure.PublicApi;

internal sealed class EventsApi(ISender sender) : IEventsApi
{
    public async Task<TicketTypeResponse?> GetTicketTypeAsync(Guid ticketTypeId,
        CancellationToken cancellationToken = default)
    {
        Result<Application.TicketTypes.GetTicketType.TicketTypeResponse> results =
            await sender.Send(new GetTicketTypeQuery(ticketTypeId), cancellationToken);

        if (results.IsFailure)
        {
            return null;
        }

        return new TicketTypeResponse(results.Value.Id, results.Value.EventId, results.Value.Name, results.Value.Price,
            results.Value.Currency, results.Value.Quantity);
    }
}
