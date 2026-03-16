namespace Evently.Client.Wpf.ApiClient.Dtos;

public abstract record EventDetailMsg
{
    private EventDetailMsg() { }

    public sealed record LoadEvent(Guid EventId) : EventDetailMsg;

    public sealed record EventLoaded(EventDto Event) : EventDetailMsg;

    public sealed record LoadFailed(string Error) : EventDetailMsg;
}
