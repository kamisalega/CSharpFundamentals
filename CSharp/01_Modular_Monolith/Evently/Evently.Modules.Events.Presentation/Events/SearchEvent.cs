using Evently.Common.Domain;
using Evently.Common.Presentation.ApiResults;
using Evently.Common.Presentation.Endpoints;
using Evently.Modules.Events.Application.Events.SearchEvents;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Events.Presentation.Events;

internal sealed class SearchEvent : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("events/search", async (ISender sender, Guid? categoryId, DateTime? startDate, DateTime? endDate,
                int page = 0, int pagesSize = 15) =>
            {
                Result<SearchEventsResponse> result =
                    await sender.Send(new SearchEventsQuery(categoryId, startDate, endDate, page, pagesSize));

                return result.Match(Results.Ok<SearchEventsResponse>, ApiResults.Problem);
            })
            .RequireAuthorization(Permissions.SearchEvents)
            .WithTags(Tags.Events);
    }

    internal sealed class Request
    {
        public DateTime StartsAtUtc { get; init; }
        public DateTime? EndsAtUtc { get; init; }
    }
}
