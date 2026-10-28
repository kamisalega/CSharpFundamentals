using Shouldly;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Domain;

namespace StranglerFig.UnitTests.Common.Application;

// The outbox/inbox jobs only know IDomainEvent/IIntegrationEvent. The base classes turn that call into the typed Handle.
public sealed class EventHandlerBaseTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task DomainEventHandler_HandlesAnUntypedEvent_AsItsTypedEvent()
    {
        var recording = new RecordingDomainEventHandler();
        IDomainEventHandler handler = recording;
        IDomainEvent domainEvent = new SomethingHappenedDomainEvent();

        await handler.Handle(domainEvent, Ct);

        recording.Handled.ShouldHaveSingleItem().ShouldBeSameAs(domainEvent);
    }

    [Fact]
    public async Task IntegrationEventHandler_HandlesAnUntypedEvent_AsItsTypedEvent()
    {
        var recording = new RecordingIntegrationEventHandler();
        IIntegrationEventHandler handler = recording;
        IIntegrationEvent integrationEvent = new SomethingPublishedIntegrationEvent();

        await handler.Handle(integrationEvent, Ct);

        recording.Handled.ShouldHaveSingleItem().ShouldBeSameAs(integrationEvent);
    }

    private sealed class SomethingHappenedDomainEvent : DomainEvent;

    private sealed class SomethingPublishedIntegrationEvent() : IntegrationEvent(Guid.NewGuid(), DateTime.UtcNow);

    private sealed class RecordingDomainEventHandler : DomainEventHandler<SomethingHappenedDomainEvent>
    {
        public List<SomethingHappenedDomainEvent> Handled { get; } = [];

        public override Task Handle(SomethingHappenedDomainEvent domainEvent, CancellationToken cancellationToken = default)
        {
            Handled.Add(domainEvent);
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingIntegrationEventHandler : IntegrationEventHandler<SomethingPublishedIntegrationEvent>
    {
        public List<SomethingPublishedIntegrationEvent> Handled { get; } = [];

        public override Task Handle(
            SomethingPublishedIntegrationEvent integrationEvent,
            CancellationToken cancellationToken = default)
        {
            Handled.Add(integrationEvent);
            return Task.CompletedTask;
        }
    }
}
