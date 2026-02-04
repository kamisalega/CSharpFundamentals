namespace Evently.Modules.Events.Application.Categories.GetCategories;

public sealed record CategoryResponse(Guid Id, string Name, bool IsArchived);
