using CommunityToolkit.Mvvm.Input;

namespace GloboTicket.Admin.Mobile.ViewModels.Base
{
    public interface IViewModelBase
    {
        IAsyncRelayCommand InitializeAsyncCommand { get; }
    }
}
