using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Messaging;
using GloboTicket.Admin.Mobile.Messages;
using GloboTicket.Admin.Mobile.ViewModels.Base;

namespace GloboTicket.Admin.Mobile.ViewModels
{
    public partial class EventListItemViewModel : ViewModelBase, IRecipient<StatusChangedMessage>
    {

        [ObservableProperty]
        private Guid _id;
        [ObservableProperty]
        private string _name;

        [ObservableProperty]
        private double _price;

        [ObservableProperty] 
        private string? _imageUrl;

        [ObservableProperty]
        private EventStatusEnum _status;

        [ObservableProperty] 
        private DateTime _date;

        [ObservableProperty]
        private List<string> _artists  = new();
        
        [ObservableProperty]
        private CategoryViewModel? _category;

        public EventListItemViewModel(
            Guid id,
            string name,
            double price,
            DateTime date,
            List<string> artists,
            EventStatusEnum status,
            string? imageUrl = null,
            CategoryViewModel? category = null)
        {
            _id = id;
            _imageUrl = imageUrl;
            _name = name;
            _price = price;
            _date = date;
            _artists = artists;
            _status = status;
            _category = category;
            
            WeakReferenceMessenger.Default.Register(this);
        }

        public void Receive(StatusChangedMessage message)
        {
           if(message.EventId == Id)
           {
               Status = message.Status;
           }
        }
    }
}
