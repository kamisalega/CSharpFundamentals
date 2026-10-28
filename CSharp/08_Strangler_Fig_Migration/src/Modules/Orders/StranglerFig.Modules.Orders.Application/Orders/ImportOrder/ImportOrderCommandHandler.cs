using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Domain;
using StranglerFig.Modules.Orders.Application.Abstractions.Data;
using StranglerFig.Modules.Orders.Domain.Orders;

namespace StranglerFig.Modules.Orders.Application.Orders.ImportOrder;

// Idempotent upsert: importing the same legacy order twice (job pass repeated, event redelivered)
// just reconciles it. Changes go through domain methods, never through setters.
internal sealed class ImportOrderCommandHandler(IOrderRepository orderRepository, IUnitOfWork unitOfWork)
    : ICommandHandler<ImportOrderCommand, ImportOrderOutcome>
{
    public async Task<Result<ImportOrderOutcome>> Handle(ImportOrderCommand request, CancellationToken cancellationToken)
    {
        Order? order = await orderRepository.GetAsync(request.OrderId, cancellationToken);

        ImportOrderOutcome outcome = ImportOrderOutcome.Updated;

        if (order is null)
        {
            order = Order.Import(request.OrderId, request.CustomerEmail, request.Total, request.CreatedAtUtc);
            orderRepository.Insert(order);
            outcome = ImportOrderOutcome.Created;
        }

        if (request.IsShipped)
        {
            order.MarkAsShipped();
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return outcome;
    }
}
