namespace Evently.Common.Application.EventBus;

public abstract class IntegrationEvent : IIntegrationEvent
{
    protected IntegrationEvent(Guid id, DateTime occurredOccurredOnUtc)
    {
        Id = id;
        OccurredOccurredOnUtc = occurredOccurredOnUtc;
    }

    public Guid Id { get; init; }
    public DateTime OccurredOccurredOnUtc { get; init; }
}
