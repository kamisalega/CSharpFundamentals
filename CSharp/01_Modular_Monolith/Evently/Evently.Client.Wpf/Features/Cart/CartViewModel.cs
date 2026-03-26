using Evently.Client.Wpf.ApiClient;
using Evently.Client.Wpf.Core;
using Evently.Client.Wpf.Core.Auth;

namespace Evently.Client.Wpf.Features.Cart;

public sealed class CartViewModel : MvuViewModel<CartModel, CartMsg>, IInitializable
{
    private readonly EventlyApiClient _api;
    private readonly TokenStore _tokenStore;

    public CartViewModel(EventlyApiClient api, TokenStore tokenStore) : base(CartModel.Empty)
    {
        _api = api;
        _tokenStore = tokenStore;
    }

    protected override (CartModel NewModel, IObservable<CartMsg>? Effect) Update(CartModel model, CartMsg message)
    {
        return CartUpdate.Update(model, message, _api, _tokenStore.UserId);
    }

    public void Initialize()
    {
        Dispatch(new CartMsg.LoadCart());
    }
}
