using FluentValidation;

namespace SalegaTech.Application.Financings
{
    public class SimulateFinancingCommandValidator : AbstractValidator<SimulateFinancingCommand>
    {
        private static readonly string[] AllowedFinancingTypes = ["LOA", "CC", "LLD"];

        public SimulateFinancingCommandValidator()
        {
            RuleFor(x => x.Amount)
                .GreaterThan(0)
                .WithMessage("Amount must be greater than zero.");

            RuleFor(x => x.NumberOfMonths)
                .InclusiveBetween(12, 84)
                .WithMessage("Number of months must be between 12 and 84.");

            RuleFor(x => x.FinancingType)
                .Must(type => AllowedFinancingTypes.Contains(type))
                .WithMessage("Financing type must be one of: LOA, CC, LLD.");

            RuleFor(x => x.ResidualValue)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Residual value cannot be negative.");

            RuleFor(x => x.ResidualValue)
                .LessThan(x => x.Amount)
                .WithMessage("Residual value must be less than total amount.");

            RuleFor(x => x.PartnerCode)
                .NotEmpty()
                .WithMessage("Partner code is required.");
        }
    }
}
