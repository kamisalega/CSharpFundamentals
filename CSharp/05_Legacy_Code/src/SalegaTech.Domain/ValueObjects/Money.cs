using SalegaTech.Common.Domain;
using SalegaTech.Domain.Exceptions;

namespace SalegaTech.Domain.ValueObjects;

public record Money
{
    public decimal Value { get; }
    public string Currency { get; }

    private Money(decimal value, string currency)
    {
        Value = value;
        Currency = currency;
    }

    public static Result<Money> Create(decimal value, string currency = "EUR")
    {
        if (value < 0)
            return Result.Failure<Money>(MoneyErrors.NegativeAmount);

        if (string.IsNullOrWhiteSpace(currency))
            return Result.Failure<Money>(MoneyErrors.EmptyCurrency);

        var rounded = Math.Round(value, 2, MidpointRounding.ToEven);
        return new Money(rounded, currency.ToUpperInvariant());
    }

    public static Money Zero(string currency = "EUR")
        => new(0m, currency.ToUpperInvariant());

    public static Result<Money> Add(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            return Result.Failure<Money>(MoneyErrors.CurrencyMismatch(a.Currency, b.Currency));

        return Create(a.Value + b.Value, a.Currency);
    }

    public static Result<Money> Subtract(Money a, Money b)
    {
        if (a.Currency != b.Currency)
            return Result.Failure<Money>(MoneyErrors.CurrencyMismatch(a.Currency, b.Currency));

        return Create(a.Value - b.Value, a.Currency);
    }

    public static Result<Money> Multiply(Money a, decimal multiplier)
    {
        return Create(a.Value * multiplier, a.Currency);
    }

    public override string ToString() => $"{Value:N2} {Currency}";
}

public static class MoneyErrors
{
    public static readonly Error NegativeAmount = Error.Failure(
        "Money.NegativeAmount",
        "Amount cannot be negative.");

    public static readonly Error EmptyCurrency = Error.Failure(
        "Money.EmptyCurrency",
        "Currency must be provided.");

    public static Error CurrencyMismatch(string a, string b) =>
        Error.Failure(
            "Money.CurrencyMismatch",
            $"Cannot perform operation on different currencies: {a} and {b}.");
}