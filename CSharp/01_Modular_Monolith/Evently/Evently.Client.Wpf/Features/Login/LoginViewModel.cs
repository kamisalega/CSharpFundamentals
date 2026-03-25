using System.Windows;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.ApiClient.Dtos;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Core.Auth;
using Evently.Client.Wpf.Features.Events;

namespace Evently.Client.Wpf.Features.Login;

public sealed class LoginViewModel : MvuViewModel<LoginModel, LoginMsg>
{
    private readonly LoginApiClient _api;
    private readonly TokenStore _tokenStore;
    private readonly NavigationService _navigation;


    public LoginViewModel(LoginApiClient api, TokenStore tokenStore, NavigationService navigation) : base(LoginModel
        .Empty)
    {
        _api = api;
        _tokenStore = tokenStore;
        _navigation = navigation;
    }

    protected override (LoginModel NewModel, IObservable<LoginMsg>? Effect) Update(LoginModel model, LoginMsg message)
    {
        var (newModel, effect) = LoginUpdate.Update(model, message, _api);

        if (message is LoginMsg.LoginSuccess success)
        {
            _tokenStore.SetTokens(success.AccessToken, success.RefreshToken);

            Application.Current.Dispatcher.BeginInvoke(() => _navigation.NavigateTo<EventListView>());
            
        }

        return (newModel, effect);
    }
}
