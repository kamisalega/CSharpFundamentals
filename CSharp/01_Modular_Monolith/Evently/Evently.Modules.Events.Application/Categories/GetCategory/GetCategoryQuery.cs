using Evently.Common.Application.Messaging;
using Evently.Modules.Events.Application.Categories.GetCategories;

namespace Evently.Modules.Events.Application.Categories.GetCategory;
public sealed record GetCategoryQuery(Guid CategoryId) : IQuery<CategoryResponse>;
