using System.Windows;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Core.Auth;
using Evently.Client.Wpf.Features.Events;

namespace Evently.Client.Wpf.Features.Login;

public sealed class LoginViewModel : MvuViewModel<LoginModel, LoginMsg>
{
    private readonly LoginApiClient _loginApi;
    private readonly TokenStore _tokenStore;
    private readonly NavigationService _navigation;
    private readonly EventlyApiClient _eventlyApiClient;


    public LoginViewModel(LoginApiClient loginLoginApi, EventlyApiClient eventlyApiClient, TokenStore tokenStore,
        NavigationService navigation) : base(LoginModel
        .Empty)
    {
        _eventlyApiClient = eventlyApiClient;
        _loginApi = loginLoginApi;
        _tokenStore = tokenStore;
        _navigation = navigation;
    }

    protected override (LoginModel NewModel, IObservable<LoginMsg>? Effect) Update(LoginModel model, LoginMsg message)
    {
        if (message is LoginMsg.LoginSuccess success)
        {
            _tokenStore.SetTokens(success.AccessToken, success.RefreshToken);
        }
        (LoginModel newModel, IObservable<LoginMsg>? effect) = LoginUpdate.Update(model, message, _loginApi, _eventlyApiClient);


        if (message is LoginMsg.ProfileLoaded profile)
        {
            _tokenStore.SetUser(profile.UserId, profile.FirstName, profile.LastName);
            Application.Current.Dispatcher.BeginInvoke(() => _navigation.NavigateTo<EventListView>());
        }

        return (newModel, effect);
    }
}
