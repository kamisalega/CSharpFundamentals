using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.Migration.Seam;

// "NewOrderModule" from the article: the new module behind the seam, reached through its public API.
internal sealed class NewOrdersModuleService(IOrdersApi ordersApi) : IOrderService
{
    public async Task<OrderDto?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        OrderResponse? order = await ordersApi.GetOrderAsync(orderId, cancellationToken);

        return order is null
            ? null
            : new OrderDto(order.Id, order.CustomerEmail, order.Total, order.Status, order.CreatedAtUtc);
    }
}
