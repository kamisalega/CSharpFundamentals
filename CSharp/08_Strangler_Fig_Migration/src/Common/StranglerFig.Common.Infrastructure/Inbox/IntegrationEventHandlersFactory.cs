using System.Collections.Concurrent;
using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using StranglerFig.Common.Application.EventBus;

namespace StranglerFig.Common.Infrastructure.Inbox;

public static class IntegrationEventHandlersFactory
{
    private static readonly ConcurrentDictionary<string, Type[]> HandlersDictionary = new();

    public static IEnumerable<IIntegrationEventHandler> GetHandlers(
        Type type,
        IServiceProvider serviceProvider,
        Assembly assembly)
    {
        Type[] integrationEventHandlerTypes = HandlersDictionary.GetOrAdd(
            $"{assembly.GetName().Name}-{type.Name}",
            _ => assembly.GetTypes()
                .Where(t => t.IsAssignableTo(typeof(IIntegrationEventHandler<>).MakeGenericType(type)))
                .ToArray());

        return integrationEventHandlerTypes
            .Select(handlerType => (IIntegrationEventHandler)serviceProvider.GetRequiredService(handlerType))
            .ToList();
    }
}
