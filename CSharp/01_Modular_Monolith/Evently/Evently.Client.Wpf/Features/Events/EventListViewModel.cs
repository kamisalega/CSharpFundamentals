using System.Reactive.Concurrency;
using System.Reactive.Linq;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Core;

namespace Evently.Client.Wpf.Features.Events;

public sealed class EventListViewModel : MvuViewModel<EventListModel, EventListMsg>, IInitializable
{
    private readonly EventlyApiClient _api;

    public EventListViewModel(EventlyApiClient api, IScheduler? scheduler = null) : base(EventListModel.Empty)
    {
        _api = api;

        Messages
            .OfType<EventListMsg.SearchTermChanged>()
            .Throttle(TimeSpan.FromMilliseconds(300), scheduler ?? Scheduler.Default)
            .DistinctUntilChanged(m => m.Term)
            .Select(m => (EventListMsg)new EventListMsg.Search(m.Term))
            .Subscribe(msg => Dispatch(msg))
            .DisposeWith(Disposables);
    }

    protected override (EventListModel NewModel, IObservable<EventListMsg>? Effect) Update(EventListModel model,
        EventListMsg message)
    {
        return EventListUpdate.Update(model, message, _api);
    }

    public void Initialize()
    {
        Dispatch(new EventListMsg.Search(string.Empty));
    }
}

public sealed class EventDetailViewModel : MvuViewModel<EventDetailModel, EventDetailMsg>, IInitializable
{
    private readonly EventlyApiClient _api;

    public EventDetailViewModel(EventlyApiClient api) : base(EventDetailModel.Empty)
    {
        _api = api;
    }

    protected override (EventDetailModel NewModel, IObservable<EventDetailMsg>? Effect) Update(EventDetailModel model,
        EventDetailMsg message)
    {
        return EventDetailUpdate.Update(model, message, _api);
    }

    public Guid EventId { get; set; }

    public void Initialize()
    {
        Dispatch(new EventDetailMsg.LoadEvent(EventId));
    }
}
