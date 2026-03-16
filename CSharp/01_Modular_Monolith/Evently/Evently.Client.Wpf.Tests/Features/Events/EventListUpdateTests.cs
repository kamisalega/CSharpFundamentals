using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Features.Events;
using FluentAssertions;

namespace Evently.Client.Wpf.Tests.Features.Events;

public sealed class EventListUpdateTests
{
    [Fact]
    public void Update_WhenSearch_ShouldSetIsLoadingAndSearchTerm()
    {
        EventListModel model = EventListModel.Empty;

        (EventListModel newModel, IObservable<EventListMsg>? effect) =
            EventListUpdate.Update(model, new EventListMsg.Search("Conference"), EventlyApiClientStub.Create());

        newModel.IsLoading.Should().BeTrue();
        newModel.SearchTerm.Should().Be("Conference");
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenEventsLoaded_ShouldPopulateListAndClearLoading()
    {
        EventListModel model = EventListModel.Empty with { IsLoading = true };
        var response = new SearchEventsResponse(1, 10, 2, [SampleEvent(), SampleEvent()]);

        (EventListModel newModel, IObservable<EventListMsg>? effect) =
            EventListUpdate.Update(model, new EventListMsg.EventsLoaded(response), EventlyApiClientStub.Create());

        newModel.Events.Should().HaveCount(2);
        newModel.IsLoading.Should().BeFalse();
        newModel.TotalCount.Should().Be(2);
        effect.Should().BeNull();
    }

    [Fact]
    public void Update_WhenLoadFailed_ShouldSetErrorAndClearLoading()
    {
        string errorMsg = "No connection";
        EventListModel model = EventListModel.Empty with { IsLoading = true };

        (EventListModel newModel, IObservable<EventListMsg>? effect) =
            EventListUpdate.Update(model, new EventListMsg.LoadFailed(errorMsg), EventlyApiClientStub.Create());

        newModel.Error.Should().Be(errorMsg);
        newModel.IsLoading.Should().BeFalse();
        effect.Should().BeNull();
    }


    [Fact]
    public void Update_WhenPageChanged_ShouldUpdatePageAndSetLoading()
    {
        EventListModel model = EventListModel.Empty;

        (EventListModel newModel, IObservable<EventListMsg>? effect) =
            EventListUpdate.Update(model, new EventListMsg.PageChanged(3), EventlyApiClientStub.Create());

        newModel.Page.Should().Be(3);
        newModel.IsLoading.Should().BeTrue();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenSearchWithEmptyTerm_ShouldStillTriggerLoad()
    {
        EventListModel model = EventListModel.Empty;

        (EventListModel newModel, IObservable<EventListMsg>? effect) =
            EventListUpdate.Update(model, new EventListMsg.Search(string.Empty), EventlyApiClientStub.Create());

        newModel.IsLoading.Should().BeTrue();
        effect.Should().NotBeNull();
    }

    private static EventDto SampleEvent() => new(
        Guid.NewGuid(), Guid.NewGuid(), "Test", "Desc", "Warsaw",
        DateTime.UtcNow, null, "Published", []);
}
