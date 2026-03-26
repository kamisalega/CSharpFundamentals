using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Events;

public abstract record EventDetailMsg
{
    private EventDetailMsg() { }

    public sealed record LoadEvent(Guid EventId) : EventDetailMsg;

    public sealed record EventLoaded(EventDto Event) : EventDetailMsg;

    public sealed record LoadFailed(string Error) : EventDetailMsg;
}
