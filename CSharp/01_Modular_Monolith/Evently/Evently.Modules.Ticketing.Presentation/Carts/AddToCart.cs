using Evently.Common.Domain;
using Evently.Common.Presentation.ApiResults;
using Evently.Common.Presentation.Endpoints;
using Evently.Modules.Ticketing.Application.Carts.AddItemToCart;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Ticketing.Presentation.Carts;

internal sealed class AddToCart : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("carts/add", async (AddToCartRequest request, ISender sender) =>
        {
            Result result = await sender.Send(
                new AddItemToCartCommand(request.CustomerId,
                    request.TicketTypeId,
                    request.Quantity));
            return result.Match(() => Results.Ok(), ApiResults.Problem);
        }).WithTags(Tags.Carts);
    }
}

public sealed class AddToCartRequest
{
    public Guid CustomerId { get; init; }
    public Guid TicketTypeId { get; init; }
    public decimal Quantity { get; init; }
};

internal static class Tags
{
    internal const string Carts = "Carts";
    internal const string Orders = "Orders";
    internal const string Tickets = "Tickets";
}
