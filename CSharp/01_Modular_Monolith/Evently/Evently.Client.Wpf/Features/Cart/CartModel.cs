using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Cart;

public sealed record CartModel(
    IReadOnlyList<CartItemDto> Items,
    decimal TotalPrice,
    bool IsLoading,
    string? Error)
{
    public static CartModel Empty => new([], 0m, false, null);
}
