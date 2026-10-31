using Microsoft.EntityFrameworkCore;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.Infrastructure.Database;

namespace StranglerFig.Modules.Orders.Infrastructure.Orders;

internal sealed class OrderRepository(OrdersDbContext context) : IOrderRepository
{
    public async Task<Order?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        await context.Orders.SingleOrDefaultAsync(o => o.Id == id, cancellationToken);

    public void Insert(Order order) => context.Orders.Add(order);
}
