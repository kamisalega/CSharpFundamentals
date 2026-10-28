using StranglerFig.Common.Domain;

namespace StranglerFig.Modules.Orders.Domain.Orders;

public sealed class OrderImportedDomainEvent(Guid orderId) : DomainEvent
{
    public Guid OrderId { get; init; } = orderId;
}
