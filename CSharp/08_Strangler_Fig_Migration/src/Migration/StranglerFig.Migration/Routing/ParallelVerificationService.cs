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

        OrderDto? newResult;
        try
        {
            newResult = await newModule.GetOrderAsync(orderId, cancellationToken);
        }
        catch (Exception exception)
        {
            // A bug in the new module must not break users - they still get the legacy answer.
            logger.LogError(exception, "New orders module failed for order {OrderId}", orderId);
            return legacyResult;
        }

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
