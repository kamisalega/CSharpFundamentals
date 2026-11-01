using Shouldly;
using StranglerFig.Common.Domain;

namespace StranglerFig.UnitTests.Common.Domain;

public sealed class EntityTests
{
    [Fact]
    public void Raise_RecordsTheDomainEvent()
    {
        var entity = new TestEntity();

        entity.DoSomething();

        entity.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<SomethingHappenedDomainEvent>();
    }

    [Fact]
    public void ClearDomainEvents_RemovesTheRecordedEvents()
    {
        var entity = new TestEntity();
        entity.DoSomething();

        entity.ClearDomainEvents();

        entity.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void DomainEvent_GetsAUniqueId_AndAUtcTimestamp()
    {
        var first = new SomethingHappenedDomainEvent();
        var second = new SomethingHappenedDomainEvent();

        first.Id.ShouldNotBe(Guid.Empty);
        first.Id.ShouldNotBe(second.Id);
        first.OccurredOnUtc.Kind.ShouldBe(DateTimeKind.Utc);
    }

    private sealed class SomethingHappenedDomainEvent : DomainEvent;

    private sealed class TestEntity : Entity
    {
        public void DoSomething() => Raise(new SomethingHappenedDomainEvent());
    }
}
