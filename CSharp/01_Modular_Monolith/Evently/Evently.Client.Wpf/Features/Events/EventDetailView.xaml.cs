using System.Windows;
using System.Windows.Controls;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Features.Cart;

namespace Evently.Client.Wpf.Features.Events;

/// <summary>
/// Interaction logic for EventDetailView.xaml
/// </summary>
public partial class EventDetailView : UserControl
{
    private readonly NavigationService _navigation;

    public EventDetailView(EventDetailViewModel vm, NavigationService navigation)
    {
        InitializeComponent();
        DataContext = vm;
        _navigation = navigation;
    }

    private void BackButton_Click(object sender, RoutedEventArgs e)
    {
        _navigation.NavigateTo<EventListView>();
    }

    private void AddToCart_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: Guid ticketTypeId })
        {
            _navigation.NavigateTo<CartView>(view =>
            {
                if (view is FrameworkElement { DataContext: CartViewModel cartVm })
                {
                    cartVm.Dispatch(new CartMsg.AddItem(ticketTypeId, 1));
                }
            });
        }
    }
}
