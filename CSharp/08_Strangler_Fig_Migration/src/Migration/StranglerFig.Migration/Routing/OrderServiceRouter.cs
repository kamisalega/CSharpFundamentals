using Microsoft.FeatureManagement;
using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Routing;

internal sealed class OrderServiceRouter(
    LegacyOrdersClient legacy,
    NewOrdersModuleService newModule,
    IFeatureManager featureManager) : IOrderService
{
    // The flag is checked on every call, so changing configuration moves traffic without a redeploy.
    // Turning it off again is the rollback.
    public async Task<OrderDto?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        await featureManager.IsEnabledAsync(FeatureFlags.NewOrdersModule, cancellationToken)
            ? await newModule.GetOrderAsync(orderId, cancellationToken)
            : await legacy.GetOrderAsync(orderId, cancellationToken);
}
