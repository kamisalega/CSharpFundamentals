using Evently.Modules.Events.Application.Events.SearchEvents;
using Evently.Common.Domain;
using Evently.Modules.Events.Presentation.ApiResults;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Events.Presentation.Events;

internal static class SearchEvent
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("events/search", async (ISender sender, Guid? categoryId, DateTime? startDate, DateTime? endDate,
            int page = 0, int pagesSize = 15) =>
        {
            Result<SearchEventsResponse> result = await sender.Send(new SearchEventsQuery(categoryId, startDate, endDate, page, pagesSize));

            return result.Match(Results.Ok<SearchEventsResponse>, ApiResults.ApiResults.Problem);
        }).WithTags(Tags.Events);
    }

    internal sealed class Request
    {
        public DateTime StartsAtUtc { get; init; }
        public DateTime? EndsAtUtc { get; init; }
    }
}
