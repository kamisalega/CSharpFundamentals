using Newtonsoft.Json;
using Shouldly;
using StranglerFig.Common.Domain;
using StranglerFig.Common.Infrastructure.Serialization;

namespace StranglerFig.UnitTests.Common.Infrastructure;

public sealed class SerializerSettingsTests
{
    [Fact]
    public void DomainEvent_DeserializedAsTheInterface_ComesBackAsItsConcreteType()
    {
        var domainEvent = new OrderPackedDomainEvent { Parcels = 3 };
        string json = JsonConvert.SerializeObject(domainEvent, SerializerSettings.Instance);

        IDomainEvent restored = JsonConvert.DeserializeObject<IDomainEvent>(json, SerializerSettings.Instance)!;

        OrderPackedDomainEvent typed = restored.ShouldBeOfType<OrderPackedDomainEvent>();
        typed.Id.ShouldBe(domainEvent.Id);
        typed.Parcels.ShouldBe(3);
    }
}

internal sealed class OrderPackedDomainEvent : DomainEvent
{
    public int Parcels { get; init; }
}
