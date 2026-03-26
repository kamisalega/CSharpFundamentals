using System.Text.Json.Serialization;

namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record LoginResponse(
    [property: JsonPropertyName("access_token")]
    string AccessToken,
    [property: JsonPropertyName("refresh_token")]
    string RefreshToken,
    [property: JsonPropertyName("expires_in")]
    int ExpiresIn);

public sealed record UserResponse(Guid Id, string Email, string FirstName, string LastName);
