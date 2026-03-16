using System.Reactive.Linq;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Events;

public static class EventListEffects
{
    public static IObservable<EventListMsg> SearchEvents(EventlyApiClient api, string term, int page, int pageSize)
    {
        return Observable.FromAsync(ct => api.SearchEventsAsync(term, page, pageSize, ct))
            .Select(response =>
                response is not null
                    ? (EventListMsg)new EventListMsg.EventsLoaded(response)
                    : new EventListMsg.LoadFailed("No Data")).Catch<EventListMsg, Exception>(ex =>
                Observable.Return((EventListMsg)new EventListMsg.LoadFailed(ex.Message)));
    }
}
