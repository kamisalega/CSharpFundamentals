using System.Windows;
using System.Windows.Controls;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Login;

/// <summary>
/// Interaction logic for LoginView.xaml
/// </summary>
public partial class LoginView : UserControl
{
    public LoginView(LoginViewModel vm)
    {
        InitializeComponent();
        DataContext = vm;
    }

    private void Email_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (DataContext is LoginViewModel vm && sender is TextBox tb)
        {
            vm.Dispatch(new LoginMsg.EmailChanged(tb.Text));
        }
    }

    private void Password_PasswordChanged(object sender, RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel vm && sender is PasswordBox pb)
        {
            vm.Dispatch(new LoginMsg.PasswordChanged(pb.Password));
        }
    }

    private void Submit_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel vm)
        {
            vm.Dispatch(new LoginMsg.Submit());
        }
    }
}
