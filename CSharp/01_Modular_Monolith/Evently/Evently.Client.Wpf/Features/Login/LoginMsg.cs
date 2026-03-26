namespace Evently.Client.Wpf.Features.Login;

public abstract record LoginMsg
{
    private LoginMsg() { }

    public sealed record EmailChanged(string Email) : LoginMsg;

    public sealed record PasswordChanged(string Password) : LoginMsg;

    public sealed record Submit : LoginMsg;

    public sealed record LoginSuccess(string AccessToken, string RefreshToken) : LoginMsg;

    public sealed record LoginFailed(string Error) : LoginMsg;

    public sealed record ProfileLoaded(Guid UserId, string FirstName, string LastName) : LoginMsg;
}
