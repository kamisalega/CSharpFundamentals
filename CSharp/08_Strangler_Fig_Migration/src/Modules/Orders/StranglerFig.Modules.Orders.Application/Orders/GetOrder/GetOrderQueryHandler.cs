using System.Data.Common;
using Dapper;
using StranglerFig.Common.Application.Data;
using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Domain;
using StranglerFig.Modules.Orders.Domain.Orders;

namespace StranglerFig.Modules.Orders.Application.Orders.GetOrder;

// Reads go straight to SQL with Dapper, writes go through EF and the domain model - as in Evently.
internal sealed class GetOrderQueryHandler(IDbConnectionFactory dbConnectionFactory)
    : IQueryHandler<GetOrderQuery, OrderResponse>
{
    public async Task<Result<OrderResponse>> Handle(GetOrderQuery request, CancellationToken cancellationToken)
    {
        await using DbConnection connection = await dbConnectionFactory.OpenConnectionAsync();

        const string sql =
            $"""
             SELECT
                 id AS {nameof(OrderResponse.Id)},
                 customer_email AS {nameof(OrderResponse.CustomerEmail)},
                 total AS {nameof(OrderResponse.Total)},
                 status AS {nameof(OrderResponse.Status)},
                 created_at_utc AS {nameof(OrderResponse.CreatedAtUtc)}
             FROM orders.orders
             WHERE id = @OrderId
             """;

        OrderResponse? order = await connection.QuerySingleOrDefaultAsync<OrderResponse>(sql, request);

        return order ?? Result.Failure<OrderResponse>(OrderErrors.NotFound(request.OrderId));
    }
}
