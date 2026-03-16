using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Events;

public static class EventListUpdate
{
    public static (EventListModel NewModel, IObservable<EventListMsg>? Effect) Update(EventListModel model,
        EventListMsg msg, EventlyApiClient apiClient)
    {
        return msg switch
        {
            EventListMsg.SearchTermChanged m => (
                model with { SearchTerm = m.Term },
                null),

            EventListMsg.Search m => (
                model with { IsLoading = true, SearchTerm = m.Term, Error = null },
                EventListEffects.SearchEvents(apiClient, m.Term, model.Page, model.PageSize)),
            EventListMsg.PageChanged m => (
                model with
                {
                    IsLoading = true,
                    Page = m.Page,
                    Error = null
                }, EventListEffects.SearchEvents(apiClient, model.SearchTerm, model.Page, model.PageSize)
            ),
            EventListMsg.EventsLoaded m => (
                model with
                {
                    IsLoading = false,
                    Events = m.Response.Events,
                    TotalCount = m.Response.TotalCount,
                    Page = m.Response.Page
                },
                null),

            EventListMsg.LoadFailed m => (
                model with { IsLoading = false, Error = m.Error },
                null),

            _ => throw new InvalidOperationException($"Unhandled message: {msg}")
        };
    }
}
