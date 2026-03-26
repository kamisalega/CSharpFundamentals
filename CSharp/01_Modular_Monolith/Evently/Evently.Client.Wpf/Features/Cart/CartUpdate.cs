using Evently.Client.Wpf.ApiClient;

namespace Evently.Client.Wpf.Features.Cart;

public sealed class CartUpdate
{
    public static (CartModel newModel, IObservable<CartMsg>? effect) Update(CartModel model, CartMsg msg,
        EventlyApiClient api)
    {
        return msg switch
        {
            CartMsg.LoadCart => (model with { IsLoading = true, Error = null }, CartEffects.LoadCart(api)),
            CartMsg.CartLoaded m => (model with
            {
                Items = m.Cart.Item,
                TotalPrice = m.Cart.Item.Sum(i => i.Quantity * i.UnitPrice),
                IsLoading = false,
                Error = null
            }, null),
            CartMsg.AddItem m => (model with { IsLoading = true },
                CartEffects.AddItem(api, m.TicketTypeId, m.Quantity)),
            CartMsg.RemoveItem m => (model with { IsLoading = true }, CartEffects.RemoveItem(api, m.TicketTypeId)),
            CartMsg.CartUpdated => (model with { IsLoading = true }, CartEffects.LoadCart(api)),
            CartMsg.LoadFailed m => (model with { IsLoading = false, Error = m.Error }, null),
            _ => throw new InvalidOperationException($"Unhandled message: {msg}")
        };
    }
}
