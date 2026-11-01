using Microsoft.Extensions.Logging;
using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Routing;

// Read paths only: calling a write twice would duplicate its side effects.
internal sealed class ParallelVerificationService(
    LegacyOrdersClient legacy,
    NewOrdersModuleService newModule,
    ILogger<ParallelVerificationService> logger) : IOrderService
{
    public async Task<OrderDto?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        OrderDto? legacyResult = await legacy.GetOrderAsync(orderId, cancellationToken);

        OrderDto? newResult = await newModule.GetOrderAsync(orderId, cancellationToken);

        // OrderDto is a record, so Equals compares values, not references.
        if (!Equals(legacyResult, newResult))
        {
            logger.LogWarning(
                "Order {OrderId} mismatch. Legacy: {@Legacy}, New: {@New}",
                orderId,
                legacyResult,
                newResult);
        }

        return legacyResult;
    }
}
