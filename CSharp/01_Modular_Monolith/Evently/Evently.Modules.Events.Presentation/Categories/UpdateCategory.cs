using Evently.Common.Domain;
using Evently.Common.Presentation.ApiResults;
using Evently.Common.Presentation.Endpoints;
using Evently.Modules.Events.Application.UpdateCategory;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Events.Presentation.Categories;

internal sealed class UpdateCategory : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("categories/{id}", async (Guid id, UpdateCategoryRequest request, ISender sender) =>
        {
            Result result = await sender.Send(new UpdateCategoryCommand(id, request.Name));

            return result.Match(() => Results.Ok(), ApiResults.Problem);
        })
        .RequireAuthorization(Permissions.ModifyCategories)
        .WithTags(Tags.Categories);
    }

    internal sealed class UpdateCategoryRequest
    {
        public string Name { get; init; }
    }
}
