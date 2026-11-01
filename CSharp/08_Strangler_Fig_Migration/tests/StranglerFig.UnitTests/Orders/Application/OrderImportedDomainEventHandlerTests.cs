using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using StranglerFig.Common.Application;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Application.Exceptions;
using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Domain;
using StranglerFig.Common.Infrastructure.Outbox;
using StranglerFig.Modules.Orders.Application.Orders.GetOrder;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.IntegrationEvents;
using OrdersApplication = StranglerFig.Modules.Orders.Application.AssemblyReference;

namespace StranglerFig.UnitTests.Orders.Application;

// Handlers are found the way ProcessOutboxJob finds them: DomainEventHandlersFactory over the Application assembly.
public sealed class OrderImportedDomainEventHandlerTests
{
    private static readonly Guid OrderId = Guid.NewGuid();

    private readonly FakeEventBus _eventBus = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Publishes_OrderImportedIntegrationEvent_WithTheCurrentOrderData()
    {
        var order = new OrderResponse(OrderId, "jan@test.local", 149.99m, "Pending", DateTime.UtcNow);
        var domainEvent = new OrderImportedDomainEvent(OrderId);

        await HandleAsync(domainEvent, order);

        OrderImportedIntegrationEvent published =
            _eventBus.Published.ShouldHaveSingleItem().ShouldBeOfType<OrderImportedIntegrationEvent>();
        published.Id.ShouldBe(domainEvent.Id);
        published.OrderId.ShouldBe(OrderId);
        published.CustomerEmail.ShouldBe(order.CustomerEmail);
        published.Total.ShouldBe(order.Total);
        published.CreatedAtUtc.ShouldBe(order.CreatedAtUtc);
    }

    [Fact]
    public async Task OrderNotFound_Throws_SoTheOutboxRecordsTheError()
    {
        await Should.ThrowAsync<StranglerFigException>(() => HandleAsync(new OrderImportedDomainEvent(OrderId), storedOrder: null));

        _eventBus.Published.ShouldBeEmpty();
    }

    private async Task HandleAsync(OrderImportedDomainEvent domainEvent, OrderResponse? storedOrder)
    {
        IServiceCollection services = new ServiceCollection()
            .AddLogging()
            .AddApplication([OrdersApplication.Assembly])
            .AddSingleton<IEventBus>(_eventBus)
            .AddSingleton<IRequestHandler<GetOrderQuery, Result<OrderResponse>>>(new FakeGetOrderQueryHandler(storedOrder));

        foreach (Type handlerType in OrdersApplication.Assembly.GetTypes()
                     .Where(t => t.IsAssignableTo(typeof(IDomainEventHandler))))
        {
            services.AddScoped(handlerType);
        }

        await using ServiceProvider provider = services.BuildServiceProvider();

        foreach (IDomainEventHandler handler in DomainEventHandlersFactory.GetHandlers(
                     domainEvent.GetType(),
                     provider,
                     OrdersApplication.Assembly))
        {
            await handler.Handle(domainEvent, Ct);
        }
    }

    private sealed class FakeGetOrderQueryHandler(OrderResponse? order) : IRequestHandler<GetOrderQuery, Result<OrderResponse>>
    {
        public Task<Result<OrderResponse>> Handle(GetOrderQuery request, CancellationToken cancellationToken) =>
            Task.FromResult(order ?? Result.Failure<OrderResponse>(OrderErrors.NotFound(request.OrderId)));
    }

    private sealed class FakeEventBus : IEventBus
    {
        public List<IIntegrationEvent> Published { get; } = [];

        public Task PublishAsync<T>(T integrationEvent, CancellationToken cancellationToken = default)
            where T : IIntegrationEvent
        {
            Published.Add(integrationEvent);
            return Task.CompletedTask;
        }
    }
}
