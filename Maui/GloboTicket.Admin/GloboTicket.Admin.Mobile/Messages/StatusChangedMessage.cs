using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
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
