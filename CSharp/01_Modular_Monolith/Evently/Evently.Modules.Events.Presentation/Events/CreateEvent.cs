using Evently.Modules.Events.Application.Events.CreateEvent;
using Evently.Modules.Events.Domain.Abstractions;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Events.Presentation.Events;

internal static class CreateEvent
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("events", async (Request request, ISender sender) =>
        {
            var command = new CreateEventCommand(
                request.CategoryId,
                request.Title,
                request.Description,
                request.Location,
                request.StartsAtUtc,
                request.EndsAtUtc);
            Result<Guid> eventId = await sender.Send(command);

            return Results.Ok(eventId);
        }).WithTags(Tags.Events);
    }

    internal sealed class Request
    {
        public Guid CategoryId { get; init; }
        public string Title { get; init; }
        public string Description { get; init; }
        public string Location { get; init; }
        public DateTime StartsAtUtc { get; init; }
        public DateTime? EndsAtUtc { get; init; }
    }
}
