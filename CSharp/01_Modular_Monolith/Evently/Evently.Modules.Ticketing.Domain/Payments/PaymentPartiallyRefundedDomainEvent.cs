using Evently.Common.Domain;

namespace Evently.Modules.Ticketing.Domain.Payments;

public class PaymentPartiallyRefundedDomainEvent(Guid paymentId, Guid transactionId, decimal refundAmount) : DomainEvent
{
    public Guid PaymentId { get; set; } = paymentId;

    public Guid TransactionId { get; init; } = transactionId;

    public decimal RefundAmount { get; init; } = refundAmount;
}
