using SalegaTech.Domain.ValueObjects;
using Shouldly;

namespace SalegaTech.Domain.Tests.ValueObjects;

public class MoneyTests
{
    [Fact]
    public void Create_WithValidAmount_ShouldSucceed()
    {
        var result = Money.Create(100.50m);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(100.50m);
        result.Value.Currency.ShouldBe("EUR");
    }

    [Fact]
    public void Create_WithNegativeAmount_ShouldFail()
    {
        var result = Money.Create(-100m);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("Money.NegativeAmount");
    }

    [Fact]
    public void Create_WithEmptyCurrency_ShouldFail()
    {
        var result = Money.Create(100m, "");

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("Money.EmptyCurrency");
    }

    [Fact]
    public void Create_ShouldRoundToTwoDecimalPlaces()
    {
        var result = Money.Create(100.125m);

        result.Value.Value.ShouldBe(100.12m);
    }

    [Fact]
    public void Add_SameCurrency_ShouldReturnSum()
    {
        var a = Money.Create(100m).Value;
        var b = Money.Create(50.30m).Value;

        var result = Money.Add(a, b);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(150.30m);
    }

    [Fact]
    public void Add_DifferentCurrency_ShouldFail()
    {
        var eur = Money.Create(100m, "EUR").Value;
        var usd = Money.Create(50m, "USD").Value;

        var result = Money.Add(eur, usd);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("Money.CurrencyMismatch");
    }

    [Fact]
    public void Subtract_ShouldReturnDifference()
    {
        var a = Money.Create(200m).Value;
        var b = Money.Create(50m).Value;

        var result = Money.Subtract(a, b);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(150m);
    }

    [Fact]
    public void Subtract_ResultingNegative_ShouldFail()
    {
        var a = Money.Create(50m).Value;
        var b = Money.Create(200m).Value;

        var result = Money.Subtract(a, b);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("Money.NegativeAmount");
    }

    [Fact]
    public void Multiply_ShouldReturnProduct()
    {
        var money = Money.Create(100m).Value;

        var result = Money.Multiply(money, 1.5m);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(150m);
    }

    [Fact]
    public void Equality_SameValue_ShouldBeEqual()
    {
        var a = Money.Create(100m, "EUR").Value;
        var b = Money.Create(100m, "EUR").Value;

        a.ShouldBe(b);
    }

    [Fact]
    public void Equality_DifferentCurrency_ShouldNotBeEqual()
    {
        var eur = Money.Create(100m, "EUR").Value;
        var usd = Money.Create(100m, "USD").Value;

        eur.ShouldNotBe(usd);
    }

    [Fact]
    public void Zero_ShouldReturnZeroAmount()
    {
        var zero = Money.Zero();

        zero.Value.ShouldBe(0m);
        zero.Currency.ShouldBe("EUR");
    }
}