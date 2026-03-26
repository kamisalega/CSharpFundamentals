using System.Reactive.Linq;
using Evently.Client.Wpf.ApiClient;

namespace Evently.Client.Wpf.Features.Login;

public static class LoginEffects
{
    public static IObservable<LoginMsg> Login(LoginApiClient api, string email, string password) =>
        Observable.FromAsync(ct => api.LoginAsync(email, password, ct))
            .Select(r => (LoginMsg)new LoginMsg.LoginSuccess(r.AccessToken, r.RefreshToken))
            .Catch<LoginMsg, Exception>(ex =>
                Observable.Return((LoginMsg)new LoginMsg.LoginFailed(ex.Message)));

    public static IObservable<LoginMsg> LoadProfile(EventlyApiClient api)
    {
        return Observable.FromAsync(async ct => await api.GetProfileAsync(ct))
            .Select(profile => profile is not null
                ? (LoginMsg) new LoginMsg.ProfileLoaded(profile.Id, profile.FirstName, profile.LastName)
                : new LoginMsg.LoginFailed("Failed to download profile"))
            .Catch<LoginMsg, Exception>(ex => Observable.Return((LoginMsg)new LoginMsg.LoginFailed(ex.Message)));
    }
}
