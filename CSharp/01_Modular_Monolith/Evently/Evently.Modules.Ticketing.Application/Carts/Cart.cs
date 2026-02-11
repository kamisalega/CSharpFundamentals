using Evently.Common.Application.Caching;

namespace Evently.Modules.Ticketing.Application.Carts;

public sealed class Cart
{
    public Guid CustomerId { get; init; }
    public List<CartItem> Items { get; init; } = [];

    internal static Cart CreateDefault(Guid customerId) => new() { CustomerId = customerId };
}

public sealed class CartItem
{
    public Guid TicketTypeId { get; set; }

    public decimal Quantity { get; set; }

    public decimal Price { get; set; }

    public string Currency { get; set; }
}

public sealed class CartService(ICacheService cacheService)
{
    private static readonly TimeSpan DefaultExpiration = TimeSpan.FromMinutes(20);

    public async Task<Cart> GetAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        string cacheKey = CreateCacheKey(customerId);

        Cart cart = await cacheService.GetAsync<Cart>(cacheKey, cancellationToken) ?? Cart.CreateDefault(customerId);

        return cart;
    }

    public async Task ClearAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        string cacheKey = CreateCacheKey(customerId);

        var cart = Cart.CreateDefault(customerId);

        await cacheService.SetAsync(cacheKey, cart, DefaultExpiration, cancellationToken);
    }

    public async Task AddItemAsync(Guid customerId, CartItem cartItem, CancellationToken cancellationToken = default)
    {
        string cacheKey = CreateCacheKey(customerId);

        Cart cart = await GetAsync(customerId, cancellationToken);

        CartItem? existingCartitem = cart.Items.Find(c => c.TicketTypeId == cartItem.TicketTypeId);

        if (existingCartitem is null)
        {
            cart.Items.Add(cartItem);
        }
        else
        {
            existingCartitem.Quantity += cartItem.Quantity;
        }

        await cacheService.SetAsync(cacheKey, cart, DefaultExpiration, cancellationToken);
    }

    public async Task RemoveItemAsync(Guid customerId, Guid ticketTypeId, CancellationToken cancellationToken = default)
    {
        string cacheKey = CreateCacheKey(customerId);

        Cart cart = await GetAsync(customerId, cancellationToken);

        CartItem? cartItem = cart.Items.Find(c => c.TicketTypeId == ticketTypeId);

        if (cartItem is null)
        {
            return;
        }

        cart.Items.Remove(cartItem);


        await cacheService.SetAsync(cacheKey, cart, DefaultExpiration, cancellationToken);
    }


    private static string CreateCacheKey(Guid customerId) => $"carts:{customerId}";
}
