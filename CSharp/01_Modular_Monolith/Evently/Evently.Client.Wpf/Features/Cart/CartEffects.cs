using System.Reactive.Linq;
using Evently.Client.Wpf.ApiClient;

namespace Evently.Client.Wpf.Features.Cart;

public static class CartEffects
{
    public static IObservable<CartMsg> LoadCart(EventlyApiClient api)
    {
        return Observable.FromAsync(async ct => await api.GetCartAsync(ct))
            .Select(cart =>
                cart is not null ? (CartMsg)new CartMsg.CartLoaded(cart) : new CartMsg.LoadFailed("Basket not found"))
            .Catch<CartMsg, Exception>(ex =>
                Observable.Return((CartMsg)new CartMsg.LoadFailed(ex.Message)));
    }

    public static IObservable<CartMsg> AddItem(EventlyApiClient api, Guid ticketTypeId, int quantity)
    {
        return Observable.FromAsync(async ct => await api.AddToCartAsync(ticketTypeId, quantity, ct))
            .Select(_ =>
                (CartMsg)new CartMsg.CartUpdated())
            .Catch<CartMsg, Exception>(ex =>
                Observable.Return((CartMsg)new CartMsg.LoadFailed(ex.Message)));
    }

    public static IObservable<CartMsg> RemoveItem(EventlyApiClient api, Guid ticketTypeId)
    {
        return Observable.FromAsync(ct => api.RemoveFromCartAsync(ticketTypeId, ct))
            .Select(_ => (CartMsg)new CartMsg.CartUpdated())
            .Catch<CartMsg, Exception>(ex =>
                Observable.Return((CartMsg)new CartMsg.LoadFailed(ex.Message)));
    }
}
