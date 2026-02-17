using Evently.Common.Domain;
using Evently.Modules.Events.Domain.TicketTypes;
using Evently.Modules.Ticketing.Domain.Customers;

namespace Evently.Modules.Ticketing.Domain.Orders;

public sealed class Order : Entity
{
    private readonly List<OrderItem> _orderItems = [];

    private Order()
    {
    }


    public Guid Id { get; private set; }

    public Guid CustomerId { get; private set; }

    public OrderStatus Status { get; private set; }

    public decimal TotalPrice { get; private set; }

    public string Currency { get; private set; }

    public bool TicketsIssued { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public IReadOnlyCollection<OrderItem> OrderItems => _orderItems.ToList();

    public static Order Create(Customer customer)
    {
        var order = new Order()
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            Status = OrderStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow
        };

        order.Raise(new OrderCreatedDomainEvent(order.Id));

        return order;
    }

    public void AddItem(TicketType ticketType, decimal quantity, decimal price, string currency)
    {
        var orderItem = OrderItem.Create(Id, ticketType.Id, quantity, price, currency);
        _orderItems.Add(orderItem);

        TotalPrice = _orderItems.Sum(o => o.Price);
        Currency = currency;
    }
}

public sealed class OrderCreatedDomainEvent(Guid orderId) : DomainEvent
{
    public Guid OrderId { get; init; } = orderId;
}

public sealed class OrderItem
{
    public OrderItem()
    {
    }

    public Guid Id { get; private set; }

    public Guid OrderId { get; private set; }

    public Guid TicketTypeId { get; private set; }

    public decimal Quantity { get; private set; }

    public decimal UnitPrice { get; private set; }

    public decimal Price { get; private set; }

    public string Currency { get; private set; }

    internal static OrderItem Create(Guid orderId, Guid ticketTypeId, decimal quantity, decimal unitPrice,
        string currency)
    {
        var orderItem = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            TicketTypeId = ticketTypeId,
            Quantity = quantity,
            UnitPrice = unitPrice,
            Price = quantity * unitPrice,
            Currency = currency
        };

        return orderItem;
    }
}

public enum OrderStatus
{
    Pending = 0,
    Paid = 1,
    Refunded = 2,
    Canceled = 3
}
