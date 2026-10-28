using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Infrastructure.Inbox;
using StranglerFig.Common.Infrastructure.Outbox;

namespace StranglerFig.UnitTests.Common.Infrastructure;

// The outbox/inbox jobs know only the event's runtime type. The factories find its handlers in a module's assembly.
public sealed class HandlersFactoryTests
{
    [Fact]
    public void DomainEventHandlersFactory_ResolvesEveryHandlerOfTheEvent()
    {
        using ServiceProvider services = new ServiceCollection()
            .AddScoped<NotifyWarehouseHandler>()
            .AddScoped<PrintLabelHandler>()
            .BuildServiceProvider();

        IEnumerable<IDomainEventHandler> handlers = DomainEventHandlersFactory.GetHandlers(
            typeof(OrderPackedDomainEvent),
            services,
            typeof(HandlersFactoryTests).Assembly);

        handlers.Select(h => h.GetType()).ShouldBe([typeof(NotifyWarehouseHandler), typeof(PrintLabelHandler)], ignoreOrder: true);
    }

    [Fact]
    public void IntegrationEventHandlersFactory_ResolvesEveryHandlerOfTheEvent()
    {
        using ServiceProvider services = new ServiceCollection()
            .AddScoped<CustomerRegisteredHandler>()
            .BuildServiceProvider();

        IEnumerable<IIntegrationEventHandler> handlers = IntegrationEventHandlersFactory.GetHandlers(
            typeof(CustomerRegisteredIntegrationEvent),
            services,
            typeof(HandlersFactoryTests).Assembly);

        handlers.ShouldHaveSingleItem().ShouldBeOfType<CustomerRegisteredHandler>();
    }
}

internal sealed class NotifyWarehouseHandler : DomainEventHandler<OrderPackedDomainEvent>
{
    public override Task Handle(OrderPackedDomainEvent domainEvent, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}

internal sealed class PrintLabelHandler : DomainEventHandler<OrderPackedDomainEvent>
{
    public override Task Handle(OrderPackedDomainEvent domainEvent, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}

internal sealed class CustomerRegisteredIntegrationEvent() : IntegrationEvent(Guid.NewGuid(), DateTime.UtcNow);

internal sealed class CustomerRegisteredHandler : IntegrationEventHandler<CustomerRegisteredIntegrationEvent>
{
    public override Task Handle(
        CustomerRegisteredIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
