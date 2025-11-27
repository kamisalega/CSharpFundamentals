using GloboTicket.Admin.Mobile.ViewModels;

namespace GloboTicket.Admin.Mobile.Views;

public partial class EventAddEditPage : ContentPageBase
{
	public EventAddEditPage(EventAddEditViewModel vm)
	{
		InitializeComponent();
        BindingContext = vm;
    }
}