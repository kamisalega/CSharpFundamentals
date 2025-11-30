using GloboTicket.Admin.Mobile.ViewModels;

namespace GloboTicket.Admin.Mobile.Messages
{
    public class StatusChangedMessage
    {
         
            public Guid EventId { get; }
         
            public EventStatusEnum Status { get; }
         
            public StatusChangedMessage(Guid id, EventStatusEnum status)
            {
                EventId = id;
                Status = status;
            }
    }
}
