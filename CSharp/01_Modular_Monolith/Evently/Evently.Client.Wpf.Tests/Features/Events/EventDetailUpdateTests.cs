using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Features.Events;
using FluentAssertions;

namespace Evently.Client.Wpf.Tests.Features.Events;

public class EventDetailUpdateTests
{
    [Fact]
    public void Update_WhenLoadEvent_ShouldSetIsLoading()
    {
        // Arrange
        EventDetailModel model = EventDetailModel.Empty;

        // Act
        (EventDetailModel newModel, IObservable<EventDetailMsg>? effect) =
            EventDetailUpdate.Update(model, new EventDetailMsg.LoadEvent(Guid.NewGuid()), EventlyApiClientStub.Create());

        //Assert
        newModel.IsLoading.Should().BeTrue();
        newModel.Error.Should().BeNull();
        effect.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenEventLoaded_ShouldPopulateEventAndTicketTypes()
    {
        // Arrange
        EventDetailModel model = EventDetailModel.Empty;


        // Act
        (EventDetailModel newModel, IObservable<EventDetailMsg>? effect) =
            EventDetailUpdate.Update(model, new EventDetailMsg.EventLoaded(SampleEvent()), EventlyApiClientStub.Create());

        //Assert
        newModel.Event.Should().NotBeNull();
        newModel.TicketTypes.Count.Should().BeGreaterThan(0);
        newModel.IsLoading.Should().BeFalse();
        effect.Should().BeNull();
    }


    [Fact]
    public void Update_WhenLoadFailed_ShouldSetErrorAndClearLoading()
    {
        // Arrange
        EventDetailModel model = EventDetailModel.Empty;


        // Act
        (EventDetailModel newModel, IObservable<EventDetailMsg>? effect) =
            EventDetailUpdate.Update(model, new EventDetailMsg.LoadFailed("Connection error"), EventlyApiClientStub.Create());

        //Assert
        newModel.Error.Should().NotBeEmpty();
        newModel.IsLoading.Should().BeFalse();
        effect.Should().BeNull();
    }


    [Fact]
    public void Update_WhenEventLoaded_ShouldReturnNoEffect()
    {
        // Arrange
        EventDetailModel model = EventDetailModel.Empty;


        // Act
        (EventDetailModel newModel, IObservable<EventDetailMsg>? effect) =
            EventDetailUpdate.Update(model, new EventDetailMsg.EventLoaded(SampleEvent()), EventlyApiClientStub.Create());

        //Assert
        newModel.Error.Should().NotBeEmpty();
        newModel.IsLoading.Should().BeFalse();
        effect.Should().BeNull();
    }

    private static EventDto SampleEvent() => new(
        Guid.NewGuid(), Guid.NewGuid(), "Test", "Desc", "Warsaw",
        DateTime.UtcNow, null, "Published", SampleTicketTypeList());

    private static List<TicketTypeDto> SampleTicketTypeList() => new()
    {
        new TicketTypeDto(Guid.NewGuid(), "TestTicketTypeName", 22, "PLN", 3)
    };
}
