using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public interface INavigationService
    {
        Task GoToEventDetail(Guid selectedEventId);
        Task GoToAddEvent();
        Task GoToEditEvent(EventModel detailModel);
    }
}
