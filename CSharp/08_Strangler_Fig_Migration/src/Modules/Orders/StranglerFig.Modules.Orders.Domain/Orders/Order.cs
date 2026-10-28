using StranglerFig.Common.Domain;

namespace StranglerFig.Modules.Orders.Domain.Orders;

public sealed class Order : Entity
{
    private Order()
    {
    }

    public Guid Id { get; private set; }

    public string CustomerEmail { get; private set; } = string.Empty;

    public decimal Total { get; private set; }

    public OrderStatus Status { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    // During the migration orders are born in legacy and imported here. The id is kept,
    // so GET /orders/{id} works no matter which implementation answers.
    public static Order Import(Guid id, string customerEmail, decimal total, DateTime createdAtUtc)
    {
        var order = new Order
        {
            Id = id,
            CustomerEmail = customerEmail,
            Total = total,
            Status = OrderStatus.Pending,
            CreatedAtUtc = createdAtUtc
        };

        return order;
    }

    public void MarkAsShipped() => Status = OrderStatus.Shipped;
}
