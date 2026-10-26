namespace StranglerFig.Modules.Orders.Domain.Orders;

public interface IOrderRepository
{
    Task<Order?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    void Insert(Order order);
}
