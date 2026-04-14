using SalegaTech.Common.Domain;

namespace SalegaTech.Domain.ValueObjects;

public record AmortizationSchedule
{
    public IReadOnlyList<Installment> Installments { get; }
    public Money ConstantInstallment { get; }

    private AmortizationSchedule(
        IReadOnlyList<Installment> installments,
        Money constantInstallment)
    {
        Installments = installments;
        ConstantInstallment = constantInstallment;
    }

    public static Result<AmortizationSchedule> Generate(
        Money capitalToFinance,
        InterestRate rate,
        int numberOfInstallments)
    {
        if (numberOfInstallments <= 0)
            return Result.Failure<AmortizationSchedule>(AmortizationErrors.InvalidInstallmentCount);

        if (capitalToFinance.Value <= 0)
            return Result.Failure<AmortizationSchedule>(AmortizationErrors.InvalidCapital);

        var currency = capitalToFinance.Currency;
        var principal = capitalToFinance.Value;
        var r = rate.ToMonthlyRate();
        var n = numberOfInstallments;

        decimal monthlyPayment;
        if (r == 0m)
        {
            monthlyPayment = principal / n;
        }
        else
        {
            var power = (decimal)Math.Pow((double)(1m + r), n);
            monthlyPayment = principal * (r * power) / (power -
                                                        1m);
        }

        monthlyPayment = Math.Round(monthlyPayment, 2,
            MidpointRounding.ToEven);

        var remaining = principal;
        var installments = new List<Installment>(n);

        for (int i = 1; i <= n; i++)
        {
            var interest = Math.Round(remaining * r, 2,
                MidpointRounding.ToEven);
            var principalPortion = monthlyPayment - interest;
            var payment = monthlyPayment;

            if (i == n)
            {
                principalPortion = remaining;
                payment = principalPortion + interest;
            }

            remaining -= principalPortion;

            installments.Add(new Installment(
                Number: i,
                MonthlyPayment: Money.Create(payment,
                    currency).Value,
                Interest: Money.Create(interest, currency).Value,
                PrincipalPortion: Money.Create(principalPortion,
                    currency).Value,
                RemainingPrincipal:
                Money.Create(Math.Max(remaining, 0m), currency).Value
            ));
        }

        return new AmortizationSchedule(
            installments,
            Money.Create(monthlyPayment, currency).Value);
    }
}

public static class AmortizationErrors
{
    public static readonly Error InvalidInstallmentCount =
        Error.Failure(
            "Amortization.InvalidInstallmentCount",
            "Number of installments must be greater than zero.");

    public static readonly Error InvalidCapital = Error.Failure(
        "Amortization.InvalidCapital",
        "Capital to finance must be greater than zero.");
}