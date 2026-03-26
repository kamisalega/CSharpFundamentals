using Evently.Client.Wpf.ApiClient.Dtos;

namespace Evently.Client.Wpf.Features.Cart;

public abstract record CartMsg
{
    private CartMsg() { }

    public sealed record LoadCart : CartMsg;

    public sealed record CartLoaded(CartDto Cart) : CartMsg;

    public sealed record AddItem(Guid TicketTypeId, int Quantity) : CartMsg;

    public sealed record RemoveItem(Guid TicketTypeId) : CartMsg;
    public sealed record CartUpdated : CartMsg;
    public sealed record LoadFailed(string Error) : CartMsg;
}
