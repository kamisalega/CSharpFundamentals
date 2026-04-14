using SalegaTech.Common.Domain;
using SalegaTech.Domain.ValueObjects;

namespace SalegaTech.ACL.Translators;

public static class AmountTranslator
{
    public static Result<Money> ToMoney(decimal legacyValue, string currency = "EUR")
    {
        return Money.Create(legacyValue, currency);
    }
}

