using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public interface IEventRepository
    {
        
        Task<List<EventModel>> GetEvents();
      
        Task<EventModel?> GetEvent(Guid id);
     
        Task<bool> UpdateStatus(Guid id, EventStatusModel status);
    }
}
