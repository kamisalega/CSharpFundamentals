using Newtonsoft.Json;

namespace StranglerFig.Common.Infrastructure.Serialization;

// TypeNameHandling.All stores the CLR type in the JSON, so the outbox/inbox jobs can deserialize
// "IDomainEvent" / "IIntegrationEvent" back into the concrete event.
public static class SerializerSettings
{
    public static readonly JsonSerializerSettings Instance = new()
    {
        TypeNameHandling = TypeNameHandling.All,
        MetadataPropertyHandling = MetadataPropertyHandling.ReadAhead
    };
}
