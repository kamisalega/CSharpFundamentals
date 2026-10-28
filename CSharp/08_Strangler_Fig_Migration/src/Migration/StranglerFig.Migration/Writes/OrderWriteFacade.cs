using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Writes;

// Until cutover every write goes to legacy (the source of truth) through this facade.
internal sealed class OrderWriteFacade(LegacyOrdersClient legacy)
{
    public Task<OrderDto> PlaceOrderAsync(string customerEmail, decimal total, CancellationToken cancellationToken = default) =>
        legacy.PlaceOrderAsync(customerEmail, total, cancellationToken);

    public Task<bool> ShipOrderAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        legacy.ShipOrderAsync(orderId, cancellationToken);
}
