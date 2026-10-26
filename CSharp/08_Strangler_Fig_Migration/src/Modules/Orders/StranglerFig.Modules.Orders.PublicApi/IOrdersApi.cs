namespace StranglerFig.Modules.Orders.PublicApi;

// The only synchronous way into the Orders module. The migration code (router, parallel run,
// sync job) uses this instead of touching the module's DbContext or repositories.
public interface IOrdersApi
{
    Task<OrderResponse?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default);

    Task<ImportOrderResult> ImportOrderAsync(
        Guid orderId,
        string customerEmail,
        decimal total,
        bool isShipped,
        DateTime createdAtUtc,
        CancellationToken cancellationToken = default);
}

public sealed record OrderResponse(Guid Id, string CustomerEmail, decimal Total, string Status, DateTime CreatedAtUtc);

public enum ImportOrderResult
{
    Created = 0,
    Updated = 1
}
