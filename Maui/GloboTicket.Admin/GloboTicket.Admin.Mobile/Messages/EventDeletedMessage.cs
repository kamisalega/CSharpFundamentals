using Microsoft.Extensions.Logging;

namespace GloboTicket.Admin.Mobile.Messages;

public class EventDeletedMessage
{
    public EventDeletedMessage(Guid id)
    {
        EventId = id;
    }

    public Guid EventId { get; }
}