using MediatR;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Application.Exceptions;
using StranglerFig.Common.Domain;
using StranglerFig.Migration.IntegrationEvents;
using StranglerFig.Modules.Orders.Application.Orders.ImportOrder;

namespace StranglerFig.Modules.Orders.Presentation.Orders;

// Presentation is the module's entry point - for HTTP requests and for other parts' events alike.
// The handler only translates the event into a command, the logic lives in Application.
// Like everything that knows about legacy, it is deleted after cutover.
internal sealed class LegacyOrderPlacedIntegrationEventHandler(ISender sender)
    : IntegrationEventHandler<LegacyOrderPlacedIntegrationEvent>
{
    public override async Task Handle(
        LegacyOrderPlacedIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default)
    {
        Result<ImportOrderOutcome> result = await sender.Send(
            new ImportOrderCommand(
                integrationEvent.OrderId,
                integrationEvent.CustomerEmail,
                integrationEvent.Total,
                IsShipped: false,
                integrationEvent.CreatedAtUtc),
            cancellationToken);

        if (result.IsFailure)
        {
            throw new StranglerFigException(nameof(ImportOrderCommand), result.Error);
        }
    }
}
