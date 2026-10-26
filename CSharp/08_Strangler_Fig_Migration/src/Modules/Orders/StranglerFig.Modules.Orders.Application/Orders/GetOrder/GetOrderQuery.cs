using StranglerFig.Common.Application.Messaging;

namespace StranglerFig.Modules.Orders.Application.Orders.GetOrder;

public sealed record GetOrderQuery(Guid OrderId) : IQuery<OrderResponse>;

public sealed record OrderResponse(Guid Id, string CustomerEmail, decimal Total, string Status, DateTime CreatedAtUtc);
