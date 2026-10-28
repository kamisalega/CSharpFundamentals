using StranglerFig.Common.Domain;

namespace StranglerFig.Modules.Orders.Domain.Orders;

public static class OrderErrors
{
    public static Error NotFound(Guid orderId) =>
        Error.NotFound("Orders.NotFound", $"The order with the identifier {orderId} was not found");
}
