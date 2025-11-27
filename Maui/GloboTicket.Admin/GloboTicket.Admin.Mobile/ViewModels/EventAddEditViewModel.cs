using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GloboTicket.Admin.Mobile.ViewModels.Base;
using System.Collections.ObjectModel;
using GloboTicket.Admin.Mobile.Models;
using GloboTicket.Admin.Mobile.Services;



namespace GloboTicket.Admin.Mobile.ViewModels
{
    public partial class EventAddEditViewModel : ViewModelBase, IQueryAttributable
    {
        private readonly IEventService _eventService;
        private readonly ICategoryService _categoryService;

        public EventModel? eventDetail;

        [ObservableProperty]
        private string _pageTitle = default!;

        [ObservableProperty]
        private Guid _id;

        [ObservableProperty]
        private string? _name;

        [ObservableProperty]
        private double _price;

        [ObservableProperty]
        private string? _imageUrl = null;

        [ObservableProperty]
        private EventStatusEnum _eventStatus;

        [ObservableProperty]
        private DateTime? _date = DateTime.Now;

        [ObservableProperty]
        private string? _description;

        [ObservableProperty]
        private CategoryViewModel? _category = new();

        public ObservableCollection<string> Artists { get; set; } = new();

        [ObservableProperty]
        [NotifyCanExecuteChangedFor(nameof(AddArtistCommand))]
        private string _addedArtist = default!;

        [ObservableProperty]
        private DateTime _minDate = DateTime.Now;


        public List<EventStatusEnum> StatusList { get; set; } =
            Enum.GetValues(typeof(EventStatusEnum)).Cast<EventStatusEnum>().ToList();

        public ObservableCollection<CategoryViewModel> Categories { get; set; } = new();

        [RelayCommand(CanExecute = nameof(CanAddArtist))]
        private void AddArtist()
        {
            Artists.Add(AddedArtist);
            AddedArtist = string.Empty;
        }

        private bool CanAddArtist() => !string.IsNullOrWhiteSpace(AddedArtist);

        [RelayCommand(CanExecute = nameof(CanSubmitEvent))]
        private async Task Submit()
        {
        }

        private bool CanSubmitEvent() => true;

        public EventAddEditViewModel(IEventService eventService, ICategoryService categoryService)
        {
            _eventService = eventService;
            _categoryService = categoryService;
        }

        public override async Task LoadAsync()
        {
            await Loading(
                async () =>
                {
                    List<CategoryModel> categories = await _categoryService.GetCategories();
                    MapCategories(categories);
                    if (eventDetail is null && Id != Guid.Empty)
                    {
                        eventDetail = await _eventService.GetEvent(Id);
                    }
                    MapEvent(eventDetail);
                });
        }

        private void MapCategories(List<CategoryModel> categories)
        {
            foreach (var category in categories)
            {
                Categories.Add(new CategoryViewModel
                {
                    Id = category.Id,
                    Name = category.Name
                });
            }
        }

        private void MapEvent(EventModel? model)
        {
            if (model is not null)
            {
                Id = model.Id;
                Name = model.Name;
                Price = model.Price;
                ImageUrl = model.ImageUrl;
                EventStatus = (EventStatusEnum)model.Status;
                Date = model.Date;
                Description = model.Description;
                Category = Categories.FirstOrDefault(c => c.Id == model.Category.Id && c.Name == model.Category.Name);
                foreach (string artist in model.Artists)
                {
                    Artists.Add(artist);
                }
            }

            PageTitle = Id != Guid.Empty ? "Edit event" : "Add event";
        }

        public void ApplyQueryAttributes(IDictionary<string, object> query)
        {
            if (query.Count > 0)
            {
                eventDetail = query["Event"] as EventModel;
            }
        }
    }
    
}

