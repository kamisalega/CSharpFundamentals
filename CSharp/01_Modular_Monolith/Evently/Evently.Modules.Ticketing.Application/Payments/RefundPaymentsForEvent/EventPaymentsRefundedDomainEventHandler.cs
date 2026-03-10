using Evently.Common.Application.EventBus;
using Evently.Common.Application.Messaging;
using Evently.Modules.Events.IntegrationEvents;
using Evently.Modules.Ticketing.Domain.Events;

namespace Evently.Modules.Ticketing.Application.Payments.RefundPaymentsForEvent;

internal sealed class EventPaymentsRefundedDomainEventHandler(IEventBus eventBus)
    : DomainEventHandler<EventPaymentsRefundedDomainEvent>
{
    public override async Task Handle(
        EventPaymentsRefundedDomainEvent domainEvent,
        CancellationToken cancellationToken = default)
    {
        await eventBus.PublishAsync(
            new EventPaymentsRefundedIntegrationEvent(
                domainEvent.EventId,
                domainEvent.OccurredOnUtc,
                domainEvent.EventId),
            cancellationToken);
    }
}
