using FluentValidation;

namespace StranglerFig.Modules.Orders.Application.Orders.ImportOrder;

internal sealed class ImportOrderCommandValidator : AbstractValidator<ImportOrderCommand>
{
    public ImportOrderCommandValidator()
    {
        RuleFor(c => c.OrderId).NotEmpty();
        RuleFor(c => c.CustomerEmail).NotEmpty().EmailAddress();
        RuleFor(c => c.Total).GreaterThanOrEqualTo(0);
        RuleFor(c => c.CreatedAtUtc).NotEmpty();
    }
}
