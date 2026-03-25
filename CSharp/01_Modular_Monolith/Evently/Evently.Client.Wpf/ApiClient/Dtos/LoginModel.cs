namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record LoginModel(string Email, string Password, bool IsLoading, string? Error)
{
    public static LoginModel Empty => new("", "", false, null);
}
