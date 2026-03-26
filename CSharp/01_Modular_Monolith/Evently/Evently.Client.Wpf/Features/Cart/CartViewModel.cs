using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.Core;

namespace Evently.Client.Wpf.Features.Cart;

public sealed class CartViewModel : MvuViewModel<CartModel, CartMsg>, IInitializable
{
    private readonly EventlyApiClient _api;

    public CartViewModel(EventlyApiClient api) : base(CartModel.Empty)
    {
        _api = api;
    }

    protected override (CartModel NewModel, IObservable<CartMsg>? Effect) Update(CartModel model, CartMsg message)
    {
        return CartUpdate.Update(model, message, _api);
    }

    public void Initialize()
    {
        Dispatch(new CartMsg.LoadCart());
    }
}
