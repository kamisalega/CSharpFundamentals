using System.Data.Common;
using Evently.Common.Application.Messaging;
using Evently.Common.Domain;
using Evently.Modules.Events.Domain.TicketTypes;
using Evently.Modules.Ticketing.Application.Abstractions.Data;
using Evently.Modules.Ticketing.Application.Carts;
using Evently.Modules.Ticketing.Domain.Customers;
using Evently.Modules.Ticketing.Domain.Orders;

namespace Evently.Modules.Ticketing.Application.Orders.CreateOrder;

public sealed record CreateOrderCommand(Guid CustomerId) : ICommand;

internal sealed class CreateOrderCommandHandler(
    ICustomerRepository customerRepository,
    ITicketTypeRepository ticketTypeRepository,
    CartService cartService,
    IUnitOfWork unitOfWork) : ICommandHandler<CreateOrderCommand>
{
    public async Task<Result> Handle(CreateOrderCommand request, CancellationToken cancellationToken)
    {
        await using DbTransaction transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);

        Customer? customer = await customerRepository.GetAsync(request.CustomerId, cancellationToken);

        if (customer is null)
        {
            return Result.Failure(CustomerErrors.NotFound(request.CustomerId));
        }

        var order = Order.Create(customer);

        Cart cart = await cartService.GetAsync(customer.Id, cancellationToken);

        if (!cart.Items.Any())
        {
            return Result.Failure(CartErrors.Empty);
        }

        foreach (CartItem cartItem in cart.Items)
        {
            TicketType? ticketType = await ticketTypeRepository
                .GetWithLockAsync(cartItem.TicketTypeId, cancellationToken);

            if (ticketType is null)
            {
                return Result.Failure(TicketTypeErrors.NotFound(cartItem.TicketTypeId));
            }

            Result result = ticketType.UpdateQuantity(cartItem.Quantity);

            if (result.IsFailure)
            {
                return Result.Failure(result.Error);
            }

            order.AddItem(ticketType, cartItem.Quantity, cartItem.Price, ticketType.Currency);
        }
        
        
    }
}
