using CommunityToolkit.Mvvm.ComponentModel;
using GloboTicket.Admin.Mobile.ViewModels.Base;

namespace GloboTicket.Admin.Mobile.ViewModels
{
    public partial class CategoryViewModel : ViewModelBase
    {
        [ObservableProperty]
        private Guid _id;
        [ObservableProperty]
        private string _name = default!;
    }
}
