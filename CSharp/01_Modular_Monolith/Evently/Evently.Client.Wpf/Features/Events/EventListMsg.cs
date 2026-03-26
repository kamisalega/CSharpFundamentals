using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Events;

public abstract record EventListMsg
{
    private EventListMsg() { }

    public sealed record SearchTermChanged(string Term) : EventListMsg;
    public sealed record Search(string Term) : EventListMsg;
    public sealed record PageChanged(int Page) : EventListMsg;
    public sealed record EventsLoaded(SearchEventsResponse Response) : EventListMsg;
    public sealed record LoadFailed(string Error) : EventListMsg;
}
