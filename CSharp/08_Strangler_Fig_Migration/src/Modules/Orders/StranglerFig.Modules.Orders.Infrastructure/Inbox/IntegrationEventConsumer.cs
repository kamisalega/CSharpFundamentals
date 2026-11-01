using System.Data.Common;
using Dapper;
using MassTransit;
using Newtonsoft.Json;
using StranglerFig.Common.Application.Data;
using StranglerFig.Common.Application.EventBus;
using StranglerFig.Common.Infrastructure.Inbox;
using StranglerFig.Common.Infrastructure.Serialization;

namespace StranglerFig.Modules.Orders.Infrastructure.Inbox;

// The MassTransit consumer does not handle the event - it only stores it in the module's inbox.
// ProcessInboxJob runs the actual handlers later, with retries recorded in the table.
internal sealed class IntegrationEventConsumer<TIntegrationEvent>(IDbConnectionFactory dbConnectionFactory)
    : IConsumer<TIntegrationEvent>
    where TIntegrationEvent : IntegrationEvent
{
    public async Task Consume(ConsumeContext<TIntegrationEvent> context)
    {
        await using DbConnection connection = await dbConnectionFactory.OpenConnectionAsync();

        TIntegrationEvent integrationEvent = context.Message;

        var inboxMessage = new InboxMessage
        {
            Id = integrationEvent.Id,
            Type = integrationEvent.GetType().Name,
            Content = JsonConvert.SerializeObject(integrationEvent, SerializerSettings.Instance),
            OccurredOnUtc = integrationEvent.OccurredOnUtc
        };

        // Not in Evently: a redelivered event (same Id) is ignored instead of failing on the primary key.
        const string sql =
            """
            INSERT INTO orders.inbox_messages(id, type, content, occurred_on_utc)
            VALUES (@Id, @Type, @Content::json, @OccurredOnUtc)
            ON CONFLICT (id) DO NOTHING
            """;

        await connection.ExecuteAsync(sql, inboxMessage);
    }
}
