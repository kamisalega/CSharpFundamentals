using GloboTicket.Admin.Mobile.ViewModels;

namespace GloboTicket.Admin.Mobile.Views;

public partial class EventDetailPage : ContentPageBase
{
	public EventDetailPage(EventDetailViewModel vm)
	{
		InitializeComponent();
        BindingContext = vm;
    }
}