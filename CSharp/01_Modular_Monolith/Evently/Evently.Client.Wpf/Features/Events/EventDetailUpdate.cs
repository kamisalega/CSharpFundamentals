using System.Reactive.Linq;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Events;

public static class EventDetailUpdate
{
    public static (EventDetailModel, IObservable<EventDetailMsg>?) Update(EventDetailModel model,
        EventDetailMsg message, EventlyApiClient api)
    {
        return message switch
        {
            EventDetailMsg.LoadEvent m => (model with { IsLoading = true, Error = null }, EventDetailEffects.LoadEvent(api, m.EventId)),
            EventDetailMsg.EventLoaded m => (
                model with { Event = m.Event, TicketTypes = m.Event.TicketTypes, IsLoading = false }, null),
            EventDetailMsg.LoadFailed m => (model with { Error = m.Error, IsLoading = false }, null),
            _ => throw new InvalidOperationException($"Unhandled message: {message}")
        };
    }
}

public static class EventDetailEffects
{
    public static IObservable<EventDetailMsg> LoadEvent(EventlyApiClient api, Guid eventId) => Observable
        .FromAsync(ct => api.GetEventAsync(eventId, ct)).Select(e =>
            e is not null
                ? (EventDetailMsg)new EventDetailMsg.EventLoaded(e)
                : new EventDetailMsg.LoadFailed("Event not found"))
        .Catch<EventDetailMsg, Exception>(ex =>
            Observable.Return((EventDetailMsg)new EventDetailMsg.LoadFailed(ex.Message)));
}
