using Microsoft.Extensions.Options;
using StranglerFig.Common.Application.Clock;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Migration.IntegrationEvents;
using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Writes;

// Until cutover every write goes to legacy (the source of truth) through this facade.
// Writes that reach legacy some other way (its own UI, batch jobs) produce no event.
internal sealed class OrderWriteFacade(
    LegacyOrdersClient legacy,
    IEventBus eventBus,
    IDateTimeProvider dateTimeProvider,
    IOptions<OrdersMigrationOptions> options)
{
    public async Task<OrderDto> PlaceOrderAsync(string customerEmail, decimal total, CancellationToken cancellationToken = default)
    {
        OrderDto order = await legacy.PlaceOrderAsync(customerEmail, total, cancellationToken);

        if (options.Value.SyncStrategy == SyncStrategy.Events)
        {
            // Published after legacy has committed and without an outbox on this side:
            // if the process dies right here, legacy has the order and the module never hears about it.
            await eventBus.PublishAsync(
                new LegacyOrderPlacedIntegrationEvent(
                    Guid.NewGuid(),
                    dateTimeProvider.UtcNow,
                    order.Id,
                    order.CustomerEmail,
                    order.Total,
                    order.CreatedAtUtc),
                cancellationToken);
        }

        return order;
    }

    // Like legacy before it, no event for this change.
    public Task<bool> ShipOrderAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        legacy.ShipOrderAsync(orderId, cancellationToken);
}
