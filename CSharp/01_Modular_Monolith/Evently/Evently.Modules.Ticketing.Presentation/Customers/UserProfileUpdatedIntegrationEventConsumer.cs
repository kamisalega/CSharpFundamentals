using Evently.Common.Application.EventBus;
using Evently.Common.Application.Exceptions;
using Evently.Common.Domain;
using Evently.Modules.Ticketing.Application.Customers.UpdateCustomer;
using Evently.Modules.Users.IntegrationEvents;
using MassTransit;
using MediatR;

namespace Evently.Modules.Ticketing.Presentation.Customers;

public sealed class UserProfileUpdatedIntegrationEventConsumer(ISender sender)
    : IntegrationEventHandler<UserProfileUpdatedIntegrationEvent>
{
    public async Task Consume(ConsumeContext<UserProfileUpdatedIntegrationEvent> context)
    {
        Result result = await sender.Send(
            new UpdateCustomerCommand(
                context.Message.UserId,
                context.Message.FirstName,
                context.Message.LastName),
            context.CancellationToken);

        if (result.IsFailure)
        {
            throw new EventlyException(nameof(UpdateCustomerCommand), result.Error);
        }
    }

    public override async Task Handle(UserProfileUpdatedIntegrationEvent integrationEvent, CancellationToken cancellationToken = default)
    {
        Result result = await sender.Send(
            new UpdateCustomerCommand(
                integrationEvent.UserId,
                integrationEvent.FirstName,
                integrationEvent.LastName),
            cancellationToken);

        if (result.IsFailure)
        {
            throw new EventlyException(nameof(UpdateCustomerCommand), result.Error);
        }
    }
}
