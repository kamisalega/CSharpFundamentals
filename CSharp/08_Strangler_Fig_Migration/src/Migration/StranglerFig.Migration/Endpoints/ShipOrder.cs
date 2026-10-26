using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration.Writes;

namespace StranglerFig.Migration.Endpoints;

internal sealed class ShipOrder : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("orders/{id:guid}/ship", async (Guid id, OrderWriteFacade writes, CancellationToken cancellationToken) =>
            await writes.ShipOrderAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound());
}
