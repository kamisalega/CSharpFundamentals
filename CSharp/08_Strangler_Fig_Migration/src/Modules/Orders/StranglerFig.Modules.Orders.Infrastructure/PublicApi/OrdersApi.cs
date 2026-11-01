using MediatR;
using StranglerFig.Common.Domain;
using StranglerFig.Modules.Orders.Application.Orders.GetOrder;
using StranglerFig.Modules.Orders.PublicApi;
using OrderResponse = StranglerFig.Modules.Orders.PublicApi.OrderResponse;

namespace StranglerFig.Modules.Orders.Infrastructure.PublicApi;

// The public API is a thin layer over the module's own commands and queries.
internal sealed class OrdersApi(ISender sender) : IOrdersApi
{
    public async Task<OrderResponse?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        Result<Application.Orders.GetOrder.OrderResponse> result =
            await sender.Send(new GetOrderQuery(orderId), cancellationToken);

        if (result.IsFailure)
        {
            return null;
        }

        return new OrderResponse(
            result.Value.Id,
            result.Value.CustomerEmail,
            result.Value.Total,
            result.Value.Status,
            result.Value.CreatedAtUtc);
    }
}
