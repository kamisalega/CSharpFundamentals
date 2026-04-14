using SalegaTech.Domain.ValueObjects;
using Shouldly;

namespace SalegaTech.Domain.Tests.ValueObjects;

public class InterestRateTests
{
    [Fact]
    public void Create_WithValidPercentage_ShouldSucceed()
    {
        var result = InterestRate.Create(4.99m);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ValueAsPercentage.ShouldBe(4.99m);
    }

    [Fact]
    public void Create_WithNegative_ShouldFail()
    {
        var result = InterestRate.Create(-1m);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("InterestRate.Negative");
    }

    [Fact]
    public void Create_Above100_ShouldFail()
    {
        var result = InterestRate.Create(101m);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("InterestRate.ExceedsMaximum");
    }

    [Fact]
    public void Create_WithZero_ShouldSucceed()
    {
        var result = InterestRate.Create(0m);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ValueAsPercentage.ShouldBe(0m);
    }

    [Fact]
    public void FromHundredths_499_ShouldReturn4Point99()
    {
        var result = InterestRate.FromHundredths(499);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ValueAsPercentage.ShouldBe(4.99m);
    }

    [Fact]
    public void ToMonthlyRate_12Percent_ShouldReturn0Point01()
    {
        var rate = InterestRate.Create(12m).Value;

        rate.ToMonthlyRate().ShouldBe(0.01m);
    }

    [Fact]
    public void ToAnnualRate_4Point99_ShouldReturn0Point0499()
    {
        var rate = InterestRate.Create(4.99m).Value;

        rate.ToAnnualRate().ShouldBe(0.0499m);
    }

    [Fact]
    public void Equality_SamePercentage_ShouldBeEqual()
    {
        var a = InterestRate.Create(4.99m).Value;
        var b = InterestRate.Create(4.99m).Value;

        a.ShouldBe(b);
    }
}