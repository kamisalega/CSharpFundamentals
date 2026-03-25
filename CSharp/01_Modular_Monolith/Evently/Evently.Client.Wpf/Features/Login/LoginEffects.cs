using System.Reactive.Linq;
using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Login;

public static class LoginEffects
{
    public static IObservable<LoginMsg> Login(LoginApiClient api, string email, string password) =>
        Observable.FromAsync(ct => api.LoginAsync(email, password, ct))
            .Select(r => (LoginMsg)new LoginMsg.LoginSuccess(r.AccessToken, r.RefreshToken))
            .Catch<LoginMsg, Exception>(ex =>
                Observable.Return((LoginMsg)new LoginMsg.LoginFailed(ex.Message)));
}
