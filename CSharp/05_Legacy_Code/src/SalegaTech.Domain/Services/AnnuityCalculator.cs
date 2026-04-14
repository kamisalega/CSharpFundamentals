using SalegaTech.Common.Domain;
using SalegaTech.Domain.ValueObjects;

namespace SalegaTech.Domain.Services;

public static class AnnuityCalculator
{
    private const int DefaultRateHundredths = 499;

    public static Result<InterestRate> GetDefaultRate() =>
        InterestRate.FromHundredths(DefaultRateHundredths);

    public static Result<Money> ComputeMonthlyPayment(
        Money amount,
        InterestRate annualRate,
        int months,
        Money residualValue)
    {
        if (months <= 0)
            return Result.Failure<Money>(AnnuityErrors.InvalidMonths);

        if (amount.Currency != residualValue.Currency)
            return Result.Failure<Money>(AnnuityErrors.CurrencyMismatch);

        var i = (double)annualRate.ToMonthlyRate();
        var p = (double)amount.Value;
        var vr = (double)residualValue.Value;

        if (i == 0d)
        {
            var flat = (p - vr) / months;
            return Money.Create((decimal)Math.Round(flat, 2, MidpointRounding.AwayFromZero),
                amount.Currency);
        }

        var pow = Math.Pow(1 + i, months);
        var numerator = (p - vr / pow) * i;
        var denominator = 1 - Math.Pow(1 + i, -months);

        if (denominator == 0d)
            return Result.Failure<Money>(AnnuityErrors.InvalidRate);

        var monthly = Math.Round(numerator / denominator, 2, MidpointRounding.AwayFromZero);
        return Money.Create((decimal)monthly, amount.Currency);
    }
}

public static class AnnuityErrors
{
    public static readonly Error InvalidMonths = Error.Failure(
        "Annuity.InvalidMonths", "Months must be greater than zero.");

    public static readonly Error InvalidRate = Error.Failure(
        "Annuity.InvalidRate", "Rate/months combination is invalid.");

    public static readonly Error CurrencyMismatch = Error.Failure(
        "Annuity.CurrencyMismatch", "Amount and residual value must share currency.");
}