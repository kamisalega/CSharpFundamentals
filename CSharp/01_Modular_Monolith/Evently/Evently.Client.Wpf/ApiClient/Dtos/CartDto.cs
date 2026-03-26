namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record CartDto(
    Guid CustomerId,
    List<CartItemDto> Items);
