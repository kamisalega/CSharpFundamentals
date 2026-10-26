using StranglerFig.Common.Application.Messaging;

namespace StranglerFig.Modules.Orders.Application.Orders.ImportOrder;

// One command for both sync strategies: the watermark job (via IOrdersApi)
// and the LegacyOrderPlacedIntegrationEvent handler (via the inbox).
public sealed record ImportOrderCommand(
    Guid OrderId,
    string CustomerEmail,
    decimal Total,
    bool IsShipped,
    DateTime CreatedAtUtc) : ICommand<ImportOrderOutcome>;

public enum ImportOrderOutcome
{
    Created = 0,
    Updated = 1
}
