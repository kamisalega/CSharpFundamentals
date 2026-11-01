using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration.Legacy;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Endpoints;

public sealed record PlaceOrderRequest(string CustomerEmail, decimal Total);

// The public /orders routes belong to the strangler until cutover. Writes still go to legacy.
internal sealed class PlaceOrder : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("orders", async (PlaceOrderRequest request, LegacyOrdersClient legacy, CancellationToken cancellationToken) =>
        {
            OrderDto order = await legacy.PlaceOrderAsync(request.CustomerEmail, request.Total, cancellationToken);

            return Results.Created($"/orders/{order.Id}", order);
        });
}
