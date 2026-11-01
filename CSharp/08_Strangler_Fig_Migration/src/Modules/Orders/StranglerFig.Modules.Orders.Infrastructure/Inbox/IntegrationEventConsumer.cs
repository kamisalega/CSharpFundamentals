using MassTransit;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Infrastructure.Inbox;

namespace StranglerFig.Modules.Orders.Infrastructure.Inbox;

// For now the consumer runs the module's handlers right away, inside MassTransit's delivery.
internal sealed class IntegrationEventConsumer<TIntegrationEvent>(IServiceProvider serviceProvider)
    : IConsumer<TIntegrationEvent>
    where TIntegrationEvent : IntegrationEvent
{
    public async Task Consume(ConsumeContext<TIntegrationEvent> context)
    {
        // Handlers of other parts' events live in Presentation - the module's entry point.
        IEnumerable<IIntegrationEventHandler> handlers = IntegrationEventHandlersFactory.GetHandlers(
            typeof(TIntegrationEvent),
            serviceProvider,
            Presentation.AssemblyReference.Assembly);

        foreach (IIntegrationEventHandler integrationEventHandler in handlers)
        {
            await integrationEventHandler.Handle(context.Message, context.CancellationToken);
        }
    }
}
