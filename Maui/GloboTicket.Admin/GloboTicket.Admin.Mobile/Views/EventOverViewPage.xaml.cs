using GloboTicket.Admin.Mobile.ViewModels;

namespace GloboTicket.Admin.Mobile.Views;

public partial class EventOverViewPage : ContentPageBase
{
	public EventOverViewPage(EventListOverviewViewModel vm)
	{
		InitializeComponent();
        BindingContext = vm;
    }
}