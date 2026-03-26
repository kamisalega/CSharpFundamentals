namespace Evently.Client.Wpf.Core.Auth;
public sealed class TokenStore
{
    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }
    public string FullName { get; private set; }
    public Guid UserId { get; private set; }
    public bool? IsAuthenticated  => AccessToken is not null;

    public void SetTokens(string accessToken, string refreshToken)
    {
        AccessToken = accessToken;
        RefreshToken = refreshToken;
    }

    public void SetUser(Guid id, string firstName, string lastName)
    {
        UserId = id;
        FullName = $"{firstName} {lastName}";
    }



    public void Clear()
    {
        AccessToken = null;
        RefreshToken = null;
    }

}
