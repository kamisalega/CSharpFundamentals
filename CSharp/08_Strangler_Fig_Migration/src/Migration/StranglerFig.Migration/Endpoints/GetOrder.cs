using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Endpoints;

// Reads go through the seam. The endpoint doesn't know which implementation answers.
internal sealed class GetOrder : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapGet("orders/{id:guid}", async (Guid id, IOrderService orderService, CancellationToken cancellationToken) =>
            await orderService.GetOrderAsync(id, cancellationToken) is { } order ? Results.Ok(order) : Results.NotFound());
}
