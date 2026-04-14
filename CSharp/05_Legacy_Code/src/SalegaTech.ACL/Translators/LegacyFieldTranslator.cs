using System.Globalization;
using SalegaTech.Common.Domain;
using SalegaTech.Domain.Enums;
using SalegaTech.Domain.ValueObjects;

namespace SalegaTech.ACL.Translators;

public static class LegacyFieldTranslator
{
    public static Result<InterestRate> RateFromHundredths(int hundredths)
    {
        return InterestRate.FromHundredths(hundredths);
    }

    public static Result<DateOnly> DateFromYyyyMmDd(string legacyDate)
    {
        if (string.IsNullOrWhiteSpace(legacyDate) || legacyDate.Length != 8)
            return Result.Failure<DateOnly>(LegacyTranslationErrors.InvalidDateFormat);

        if (!DateOnly.TryParseExact(
                legacyDate,
                "yyyyMMdd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var date))
        {
            return Result.Failure<DateOnly>(LegacyTranslationErrors.InvalidDateFormat);
        }

        return date;
    }

    public static Result<SimulationStatus> StatusFromCode(int legacyStatus)
    {
        return legacyStatus switch
        {
            0 => SimulationStatus.Rejected,
            1 => SimulationStatus.Approved,
            2 => SimulationStatus.Pending,
            _ => Result.Failure<SimulationStatus>(LegacyTranslationErrors.UnknownStatus(legacyStatus))
        };
    }

    public static Result<FinancingType> FinancingTypeFromCode(string legacyCode)
    {
        return legacyCode?.Trim().ToUpperInvariant() switch
        {
            "LOA" => FinancingType.LOA,
            "CC" => FinancingType.ClassicCredit,
            "LLD" => FinancingType.LLD,
            _ => Result.Failure<FinancingType>(LegacyTranslationErrors.UnknownFinancingType(legacyCode ?? ""))
        };
    }
}

public static class LegacyTranslationErrors
{
    public static readonly Error InvalidDateFormat = Error.Failure(
        "Legacy.InvalidDateFormat",
        "Legacy date must be in YYYYMMDD format.");

    public static Error UnknownStatus(int code) => Error.Failure(
        "Legacy.UnknownStatus",
        $"Unknown legacy status code: {code}.");

    public static Error UnknownFinancingType(string code) => Error.Failure(
        "Legacy.UnknownFinancingType",
        $"Unknown legacy financing type code: '{code}'.");
}