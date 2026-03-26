using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.Features.Events;
using FluentAssertions;
using Microsoft.Reactive.Testing;

namespace Evently.Client.Wpf.Tests.Features.Events;
public sealed class EventListViewModelDebounceTests : IDisposable
{
    private readonly HttpClient _httpClient = new() { BaseAddress = new Uri("https://localhost:5001") };
    private EventListViewModel _eventListViewModel;

    [Fact]
    public void Dispatch_WhenMultipleSearchesFast_ShouldThrottleToOne()
    {
        SynchronizationContext.SetSynchronizationContext(new ImmediateSynchronizationContext());

        var scheduler = new TestScheduler();
        var api = new EventlyApiClient(_httpClient);
        _eventListViewModel = new EventListViewModel(api, scheduler);


        _eventListViewModel.Dispatch(new EventListMsg.SearchTermChanged("K"));
        _eventListViewModel.Dispatch(new EventListMsg.SearchTermChanged("Ko"));
        _eventListViewModel.Dispatch(new EventListMsg.SearchTermChanged("Kon"));

        _eventListViewModel.Model.SearchTerm.Should().Be("Kon");
        _eventListViewModel.Model.IsLoading.Should().BeFalse();


        scheduler.AdvanceBy(TimeSpan.FromMilliseconds(300).Ticks);
        _eventListViewModel.Model.IsLoading.Should().BeTrue();
    }
    public void Dispose()
    {
        _httpClient.Dispose();
        _eventListViewModel.Dispose();
    }
}


public sealed class ImmediateSynchronizationContext : SynchronizationContext
{
    public override void Post(SendOrPostCallback d, object? state) => d(state);
    public override void Send(SendOrPostCallback d, object? state) => d(state);
}
