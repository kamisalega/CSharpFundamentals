using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using CommunityToolkit.Mvvm.Input;
using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Core;

namespace Evently.Client.Wpf.Features.Events;

/// <summary>
/// Interaction logic for EventListView.xaml
/// </summary>
public partial class EventListView : UserControl
{
    private readonly EventListViewModel _vm;
    private readonly NavigationService _navigation;

    public EventListView(EventListViewModel vm, NavigationService navigation)
    {
        InitializeComponent();

        _vm = vm;
        _navigation = navigation;
        DataContext = vm;
    }

    public IRelayCommand SelectEventCommand => new RelayCommand<EventDto>(e =>
    {
        if (e is null)
        {
            return;
        }

        _navigation.NavigateTo<EventDetailView>(view =>
        {
            if (view is FrameworkElement { DataContext: EventDetailViewModel detailViewModel })
            {
                detailViewModel.EventId = e.Id;
            }
        });
    });

    public IRelayCommand PrevPageCommand =>
        new RelayCommand(() => _vm.Dispatch(new EventListMsg.PageChanged(_vm.Model.Page - 1)),
            () => _vm.Model.Page > 1);

    public IRelayCommand NextPageCommand => new RelayCommand(
        () => _vm.Dispatch(new EventListMsg.PageChanged(_vm.Model.Page + 1)),
        () => _vm.Model.Page * _vm.Model.PageSize < _vm.Model.TotalCount);

    private void EventList_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (sender is ListBox { SelectedItem: EventDto selectedEvent })
        {
            SelectEventCommand.Execute(selectedEvent);
        }
    }
}
