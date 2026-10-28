using StranglerFig.Common.Application.EventBus;

namespace StranglerFig.Migration.IntegrationEvents;

// Option B from the article. Legacy (.NET Framework 2.0) can't publish it, so the migration's
// write facade does, after legacy has accepted the order. Deleted together with the migration.
public sealed class LegacyOrderPlacedIntegrationEvent : IntegrationEvent
{
    public LegacyOrderPlacedIntegrationEvent(
        Guid id,
        DateTime occurredOnUtc,
        Guid orderId,
        string customerEmail,
        decimal total,
        DateTime createdAtUtc)
        : base(id, occurredOnUtc)
    {
        OrderId = orderId;
        CustomerEmail = customerEmail;
        Total = total;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid OrderId { get; init; }

    public string CustomerEmail { get; init; }

    public decimal Total { get; init; }

    public DateTime CreatedAtUtc { get; init; }
}
