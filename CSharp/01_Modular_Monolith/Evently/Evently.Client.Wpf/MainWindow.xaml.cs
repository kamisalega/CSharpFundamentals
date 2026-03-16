using System.Windows;
using Evently.Client.Wpf.Core;

namespace Evently.Client.Wpf;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    public MainWindow(NavigationService navigationService)
    {
        InitializeComponent();

        navigationService.SetNavigationCallback(viewModel => MainContent.Content = viewModel);
    }
}
