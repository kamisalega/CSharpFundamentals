using SalegaTech.Common.Domain;

namespace SalegaTech.Domain.ValueObjects;

public record InterestRate
{
    public decimal ValueAsPercentage { get; }

    private InterestRate(decimal valueAsPercentage)
    {
        ValueAsPercentage = valueAsPercentage;
    }

    public static Result<InterestRate> Create(decimal percentage)
    {
        if (percentage < 0)
            return
                Result.Failure<InterestRate>(InterestRateErrors.Negative);

        if (percentage > 100)
            return
                Result.Failure<InterestRate>(InterestRateErrors.ExceedsMaximum);

        return new InterestRate(percentage);
    }

    public static Result<InterestRate> FromHundredths(int
        hundredths)
    {
        return Create(hundredths / 100m);
    }

    public decimal ToMonthlyRate() => ValueAsPercentage / 100m /
                                      12m;

    public decimal ToAnnualRate() => ValueAsPercentage / 100m;

    public override string ToString() =>
        $"{ValueAsPercentage:F2}%";
}

public static class InterestRateErrors
{
    public static readonly Error Negative = Error.Failure(
        "InterestRate.Negative",
        "Interest rate cannot be negative.");

    public static readonly Error ExceedsMaximum = Error.Failure(
        "InterestRate.ExceedsMaximum",
        "Interest rate cannot exceed 100%.");
}