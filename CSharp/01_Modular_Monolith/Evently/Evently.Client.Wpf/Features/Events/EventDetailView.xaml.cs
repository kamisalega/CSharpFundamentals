using System.Windows;
using System.Windows.Controls;
using Evently.Client.Wpf.Core;

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
}
