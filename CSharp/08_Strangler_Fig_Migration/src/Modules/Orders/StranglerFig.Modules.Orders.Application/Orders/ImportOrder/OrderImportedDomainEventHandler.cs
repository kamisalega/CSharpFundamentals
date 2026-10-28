using MediatR;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Application.Exceptions;
using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Domain;
using StranglerFig.Modules.Orders.Application.Orders.GetOrder;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.IntegrationEvents;

namespace StranglerFig.Modules.Orders.Application.Orders.ImportOrder;

// Runs from the outbox (ProcessOutboxJob), not inside the import's transaction.
internal sealed class OrderImportedDomainEventHandler(ISender sender, IEventBus eventBus)
    : DomainEventHandler<OrderImportedDomainEvent>
{
    public override async Task Handle(OrderImportedDomainEvent domainEvent, CancellationToken cancellationToken = default)
    {
        Result<OrderResponse> result = await sender.Send(new GetOrderQuery(domainEvent.OrderId), cancellationToken);

        if (result.IsFailure)
        {
            throw new StranglerFigException(nameof(GetOrderQuery), result.Error);
        }

        await eventBus.PublishAsync(
            new OrderImportedIntegrationEvent(
                domainEvent.Id,
                domainEvent.OccurredOnUtc,
                result.Value.Id,
                result.Value.CustomerEmail,
                result.Value.Total,
                result.Value.CreatedAtUtc),
            cancellationToken);
    }
}
