using System.Collections.ObjectModel;
using CommunityToolkit.Maui.Core.Extensions;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GloboTicket.Admin.Mobile.Models;
using GloboTicket.Admin.Mobile.Services;
using GloboTicket.Admin.Mobile.ViewModels.Base;

namespace GloboTicket.Admin.Mobile.ViewModels
{
    public partial class EventDetailViewModel : ViewModelBase, IQueryAttributable
    {
        [ObservableProperty]
        private Guid _id;
        [ObservableProperty]
        private string _name = default!;
        [ObservableProperty]
        private double _price;
        [ObservableProperty]
        private string _imageUrl;

        [ObservableProperty]
        [NotifyCanExecuteChangedFor(nameof(CancelEventCommand))]
        private EventStatusEnum _eventStatus;

        [ObservableProperty]
        [NotifyCanExecuteChangedFor(nameof(CancelEventCommand))]
        private DateTime _date = DateTime.Now;
        
        [ObservableProperty] 
        private string _description;
        [ObservableProperty] 
        private ObservableCollection<string> _artists = new();
        [ObservableProperty] 
        private CategoryViewModel _category = new();

        [ObservableProperty]
        [NotifyPropertyChangedFor(nameof(ShowThumbnailImage))]
        private bool _showLargerImage;

        private readonly IEventService _eventService;

        public bool ShowThumbnailImage => !ShowLargerImage;

        
        [RelayCommand(CanExecute = nameof(CanCancelEvent))]
        private async Task CancelEvent()
        {
            if (await _eventService.UpdateStatus(Id, EventStatusModel.Cancelled))
            {
                EventStatus = EventStatusEnum.Cancelled;
            }
        }


        private bool CanCancelEvent() => EventStatus != EventStatusEnum.Cancelled && Date.AddHours(-4) >
            DateTime.Now;

        public EventDetailViewModel(IEventService eventService)
        {
            _eventService = eventService;
            
        }

        private async  Task GetEvent(Guid id)
        {
            await Task.Delay(5000);
            var @event = await _eventService.GetEvent(id);
            if (@event != null)
            {
                MapEventData(@event);
            }
        }

        private void MapEventData(EventModel @event)
        {
            Id = @event.Id;
            Name = @event.Name;
            Price = @event.Price;
            ImageUrl = @event.ImageUrl;
            EventStatus = (EventStatusEnum)@event.Status;
            Date = @event.Date;
            Artists = @event.Artists.ToObservableCollection();
            Description = @event.Description;
            Category = new CategoryViewModel
            {
                Id = @event.Category.Id,
                Name = @event.Category.Name
            };
        }

        public async void ApplyQueryAttributes(IDictionary<string, object> query)
        {
            var eventId = query["EventId"].ToString();
            if (Guid.TryParse(eventId, out var selectedId))
            {
                Id = selectedId;
              
            }
        }

        public override async Task LoadAsync()
        {
            await Loading(async () =>
            {
                if (Id != Guid.Empty)
                {
                    await GetEvent(Id);
                }
            });
        }
    }
}
