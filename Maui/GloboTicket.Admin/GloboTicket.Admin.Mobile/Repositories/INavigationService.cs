using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public interface INavigationService
    {
        Task GoToEventDetail(Guid selectedEventId);
    }
}
