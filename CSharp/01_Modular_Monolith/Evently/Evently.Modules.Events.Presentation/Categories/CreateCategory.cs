using Evently.Common.Domain;
using Evently.Common.Presentation.ApiResults;
using Evently.Common.Presentation.Endpoints;
using Evently.Modules.Events.Application.Categories.CreateCategory;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Events.Presentation.Categories;

internal sealed class CreateCategory : IEndpoint
{
    public  void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("categories", async (CreateCategoryRequest request, ISender sender) =>
        {
            Result<Guid> result = await sender.Send(new CreateCategoryCommand(request.Name));

            return result.Match(Results.Ok<Guid>, ApiResults.Problem);
        })
        .RequireAuthorization(Permissions.ModifyCategories)
        .WithTags(Tags.Categories);
    }

    internal sealed class CreateCategoryRequest
    {
        public string Name { get; init; }
    }
}
