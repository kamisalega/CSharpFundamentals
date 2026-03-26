using System.Windows;
using System.Windows.Controls;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Features.Events;


namespace Evently.Client.Wpf.Features.Cart;

/// <summary>
/// Interaction logic for CartView.xaml
/// </summary>
public partial class CartView : UserControl
{
    private NavigationService _navigation;

    public CartView(CartViewModel vm, NavigationService navigation)
    {
        InitializeComponent();
        DataContext = vm;
        _navigation = navigation;
    }

    private void BackButton_Click(object sender, RoutedEventArgs e)
    {
        _navigation.NavigateTo<EventListView>();
    }

    private void RemoveItem_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is CartViewModel vm && sender is Button { Tag: Guid ticketTypeId })
        {
            vm.Dispatch(new CartMsg.RemoveItem(ticketTypeId));
        }
    }
}
