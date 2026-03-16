namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record CartDto(
    Guid CustomerId,
    IReadOnlyList<CartItemDto> Item);
