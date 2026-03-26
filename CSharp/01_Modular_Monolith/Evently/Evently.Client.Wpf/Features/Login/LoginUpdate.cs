using Evently.Client.Wpf.ApiClient;

namespace Evently.Client.Wpf.Features.Login;

public sealed class LoginUpdate
{
    public static (LoginModel newModel, IObservable<LoginMsg>? effect) Update(LoginModel model,
        LoginMsg msg, LoginApiClient loginApi, EventlyApiClient eventlyApi)
    {
        return msg switch
        {
            LoginMsg.EmailChanged m => (model with { Email = m.Email }, null),
            LoginMsg.PasswordChanged m => (model with { Password = m.Password }, null),
            LoginMsg.Submit => string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password)
                ? (model with { Error = "Email and password are required" }, null)
                : (model with { IsLoading = true, Error = null },
                    LoginEffects.Login(loginApi, model.Email, model.Password)),
            LoginMsg.LoginSuccess => (model with { IsLoading = false }, LoginEffects.LoadProfile(eventlyApi)),
            LoginMsg.LoginFailed m => (model with { IsLoading = false, Error = m.Error }, null),
            LoginMsg.ProfileLoaded => (model with { IsLoading = false },
                null),
            _ => throw new InvalidOperationException($"Unhandled message: {msg}")
        };
    }
}
