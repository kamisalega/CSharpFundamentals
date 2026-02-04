using Evently.Modules.Events.Application.Categories.ArchiveCategory;
using Evently.Modules.Events.Application.Categories.CreateCategory;
using Evently.Modules.Events.Domain.Abstractions;
using Evently.Modules.Events.Presentation.ApiResults;
using Evently.Modules.Events.Presentation.Events;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Events.Presentation.Categories;

internal static class ArchiveCategory
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("categories/{id}/archive", async (Guid id, ISender sender) =>
        {
            Result result = await sender.Send(new ArchiveCategoryCommand(id));

            return result.Match(() => Results.Ok(), ApiResults.ApiResults.Problem);
        });
    }
}

internal static class CreateCategory
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("categories", async (Request request, ISender sender) =>
        {
            Result<Guid> result = await sender.Send(new CreateCategoryCommand(request.Name));

            return result.Match(Results.Ok, ApiResults.ApiResults.Problem);
        });
    }

    internal sealed class Request
    {
        public string Name { get; init; }
    }
}

public static class CategoryEndpoints
{
    public static void MapEndpoints(IEndpointRouteBuilder app)
    {
        ArchiveCategory.MapEndpoint(app);
        CreateCategory.MapEndpoint(app);
    }
}
