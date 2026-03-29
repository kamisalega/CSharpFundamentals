using Evently.Common.Domain;
using Evently.Modules.Events.Domain.Categories;
using Evently.Modules.Events.Domain.Events;
using Evently.Modules.Events.UnitTests.Abstractions;
using FluentAssertions;

namespace Evently.Modules.Events.UnitTests.Events;
public class EventTests : BaseTest
{
    [Fact]
    public void Create_ShouldReturnFailure_WhenEndDatePrecedesStartDate()
    {
        // Arrange
        var category = Category.Create(Faker.Music.Genre());
        DateTime startsAtUtc = DateTime.Now;
        DateTime endsAtUtc = startsAtUtc.AddMinutes(-1);
        
        // Act
        Result<Event> result = Event.Create(category, Faker.Music.Genre(), Faker.Music.Genre(), Faker.Address.StreetAddress(), startsAtUtc, endsAtUtc);
        
        // Assert
        result.Error.Should().Be(EventErrors.EndDatePrecedesStartDate);
    }

    [Fact]
    public void Create_ShouldRaiseDomainEvent_WhenEventCreated()
    {
        // Arrange
        var category = Category.Create(Faker.Music.Genre());
        DateTime startsAtUtc = DateTime.Now;
      

        // Act
        Result<Event> result = Event.Create(category, Faker.Music.Genre(), Faker.Music.Genre(), Faker.Address.StreetAddress(), startsAtUtc, null);

        Event @event = result.Value;

        // Assert
        EventCreatedDomainEvent domainEvent = AssertDomainEventWasPublished<EventCreatedDomainEvent>(@event);

        domainEvent.EventId.Should().Be(@event.Id);
    }
}
