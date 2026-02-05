using Evently.Common.Application.Messaging;

namespace Evently.Modules.Events.Application.UpdateCategory;

public sealed record UpdateCategoryCommand(Guid CategoryId, string Name) : ICommand;
