namespace StranglerFig.Migration.Seam;

// The seam. The GET endpoint depends only on this, so the implementation behind it
// (legacy, new module, router, parallel run) can change without touching the endpoint.
public interface IOrderService
{
    Task<OrderDto?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
}
