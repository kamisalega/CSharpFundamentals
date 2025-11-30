using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public class NavigationService : INavigationService
    {
        public async Task GoToEventDetail(Guid id)
        {
            var parameters = new Dictionary<string, object> { { "EventId", id } };
            await Shell.Current.GoToAsync("event", parameters);
        }

        public Task GoToAddEvent() => Shell.Current.GoToAsync("event/add");
        public Task GoToEditEvent(EventModel detailModel)
        {
            var navigationParameter = new ShellNavigationQueryParameters
            {
                { "Event", detailModel }
            };
            
            return Shell.Current.GoToAsync("event/edit", navigationParameter);
        }

        public Task GoBack()
        {
            return Shell.Current.GoToAsync("..");
        }

        public Task GoToOverview()
        {
            return Shell.Current.GoToAsync("//MainPage");
        }
    }
}
