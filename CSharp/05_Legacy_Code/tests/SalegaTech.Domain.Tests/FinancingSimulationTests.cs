using SalegaTech.Domain.Entities;
using SalegaTech.Domain.Enums;
using SalegaTech.Domain.ValueObjects;
using Shouldly;

namespace SalegaTech.Domain.Tests;

public class FinancingSimulationTests
{
    private static FinancingSimulation CreateDefault(
        decimal amount = 25000m,
        decimal residualValue = 8000m,
        decimal monthlyPayment = 420m,
        decimal ratePercentage = 4.99m,
        int installments = 48,
        FinancingType type = FinancingType.LOA)
    {
        return FinancingSimulation.Create(
            simulationCode: "SIM-2026-001",
            amount: Money.Create(amount).Value,
            residualValue: Money.Create(residualValue).Value,
            monthlyPayment: Money.Create(monthlyPayment).Value,
            rate: InterestRate.Create(ratePercentage).Value,
            numberOfInstallments: installments,
            type: type,
            simulationDate: new DateOnly(2026, 4, 12)).Value;
    }


    [Fact]
    public void IsEligible_ValidParameters_ShouldReturnTrue()
    {
        var sim = CreateDefault();

        sim.IsEligible().ShouldBeTrue();
    }

    [Fact]
    public void IsEligible_AmountBelowMinimum_ShouldReturnFalse()
    {
        var sim = CreateDefault(amount: 1000m);

        sim.IsEligible().ShouldBeFalse();
    }

    [Fact]
    public void IsEligible_AmountAboveMaximum_ShouldReturnFalse()
    {
        var sim = CreateDefault(amount: 100000m);

        sim.IsEligible().ShouldBeFalse();
    }

    [Fact]
    public void IsEligible_TooFewInstallments_ShouldReturnFalse()
    {
        var sim = CreateDefault(installments: 6);

        sim.IsEligible().ShouldBeFalse();
    }

    [Fact]
    public void IsEligible_TooManyInstallments_ShouldReturnFalse()
    {
        var sim = CreateDefault(installments: 120);

        sim.IsEligible().ShouldBeFalse();
    }

    [Fact]
    public void CalculateTotalCost_ShouldReturnCorrectValue()
    {
        // rata 420 × 48 = 20160 + VR 8000 = 28160 - kapitał 25000 = 3160
        var sim = CreateDefault();

        var result = sim.CalculateTotalCost();

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(3160m);
    }

    [Fact]
    public void
        ApplyDiscount_ValidPercentage_ShouldReducePayment()
    {
        var sim = CreateDefault(monthlyPayment: 400m);

        var result = sim.ApplyDiscount(10m);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(360m);
    }

    [Fact]
    public void ApplyDiscount_Above50Percent_ShouldFail()
    {
        var sim = CreateDefault();

        var result = sim.ApplyDiscount(60m);

        result.IsFailure.ShouldBeTrue();

        result.Error.Code.ShouldBe("FinancingSimulation.InvalidDiscount");
    }

    [Fact]
    public void ApplyDiscount_ShouldRaiseDomainEvent()
    {
        var sim = CreateDefault();

        sim.ApplyDiscount(10m);

        sim.DomainEvents.Count.ShouldBe(1);

        sim.DomainEvents.First().ShouldBeOfType<DiscountAppliedEvent>();
    }

    [Fact]
    public void
        GenerateSchedule_ShouldReturnCorrectNumberOfInstallments()
    {
        var sim = CreateDefault();

        var result = sim.GenerateSchedule();

        result.IsSuccess.ShouldBeTrue();
        result.Value.Installments.Count.ShouldBe(48);
        result.Value.Installments.Last().RemainingPrincipal.Value.ShouldBe(0m);
    }
}