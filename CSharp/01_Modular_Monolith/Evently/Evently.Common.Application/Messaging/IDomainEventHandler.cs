using Evently.Common.Domain;
using MediatR;

namespace Evently.Common.Application.Messaging;
public interface IDomainEventHandler<in TDomainEvents> : INotificationHandler<TDomainEvents>
     where TDomainEvents : IDomainEvent
{
}
