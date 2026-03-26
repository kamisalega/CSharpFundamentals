using System.Collections.Concurrent;
using System.Reflection;
using Evently.Common.Application.EventBus;
using Microsoft.Extensions.DependencyInjection;

namespace Evently.Common.Infrastructure.Inbox;

public static class IntegrationEventHandlersFactory
{
    private static readonly ConcurrentDictionary<string, Type[]> HandlersDictionary = new();

    public static IEnumerable<IIntegrationEventHandler> GetHandlers(
        Type type,
        IServiceProvider serviceProvider,
        Assembly assembly)
    {
        Type[] domainEventHandlerTypes = HandlersDictionary.GetOrAdd(
            $"{assembly.GetName().Name}-{type.Name}",
            _ =>
            {
                Type[] domainEventHandlerTypes = assembly.GetTypes()
                    .Where(t => t.IsAssignableTo(typeof(IIntegrationEventHandler<>).MakeGenericType(type)))
                    .ToArray();

                return domainEventHandlerTypes;
            });

        List<IIntegrationEventHandler> handlers = [];
        foreach (Type domainEventHandlerType in domainEventHandlerTypes)
        {
            object domainEventHandler = serviceProvider.GetRequiredService(domainEventHandlerType);

            handlers.Add((domainEventHandler as IIntegrationEventHandler)!);
        }

        return handlers;
    }
}
