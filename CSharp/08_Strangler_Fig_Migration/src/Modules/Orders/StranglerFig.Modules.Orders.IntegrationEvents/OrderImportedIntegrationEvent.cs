using StranglerFig.Common.Application.EventBus;

namespace StranglerFig.Modules.Orders.IntegrationEvents;

// What the Orders module tells the rest of the system. Nobody listens yet - a future
// Shipping module would, and it would never have to know that the order came from legacy.
public sealed class OrderImportedIntegrationEvent : IntegrationEvent
{
    public OrderImportedIntegrationEvent(
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
