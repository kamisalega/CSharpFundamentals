using SalegaTech.Common.Domain;
using SalegaTech.Domain.Enums;
using SalegaTech.Domain.ValueObjects;

namespace SalegaTech.Domain.Entities;

public class FinancingSimulation : Entity
{
    public static readonly Money MinimumAmount =
        Money.Create(3000m).Value;
    public static readonly Money MaximumAmount =
        Money.Create(75000m).Value;
    public const int MaxInstallments = 84;
    public const int MinInstallments = 12;

    public Guid Id { get; private set; }
    public string SimulationCode { get; private set; } =
        string.Empty;
    public Money Amount { get; private set; } = null!;
    public Money ResidualValue { get; private set; } = null!;
    public Money MonthlyPayment { get; private set; } = null!;
    public InterestRate Rate { get; private set; } = null!;
    public int NumberOfInstallments { get; private set; }
    public FinancingType Type { get; private set; }
    public DateOnly SimulationDate { get; private set; }

    private FinancingSimulation() { }

    public static Result<FinancingSimulation> Create(
        string simulationCode,
        Money amount,
        Money residualValue,
        Money monthlyPayment,
        InterestRate rate,
        int numberOfInstallments,
        FinancingType type,
        DateOnly simulationDate)
    {
        if (string.IsNullOrWhiteSpace(simulationCode))
            return Result.Failure<FinancingSimulation>(
                FinancingSimulationErrors.EmptySimulationCode);

        return new FinancingSimulation
        {
            Id = Guid.NewGuid(),
            SimulationCode = simulationCode,
            Amount = amount,
            ResidualValue = residualValue,
            MonthlyPayment = monthlyPayment,
            Rate = rate,
            NumberOfInstallments = numberOfInstallments,
            Type = type,
            SimulationDate = simulationDate
        };
    }

    public bool IsEligible()
    {
        return Amount.Value >= MinimumAmount.Value
               && Amount.Value <= MaximumAmount.Value
               && NumberOfInstallments >= MinInstallments
               && NumberOfInstallments <= MaxInstallments;
    }

    public Result<Money> CalculateTotalCost()
    {
        var totalPaid = Money.Multiply(MonthlyPayment,
            NumberOfInstallments);
        if (totalPaid.IsFailure)
            return Result.Failure<Money>(totalPaid.Error);

        var totalWithResidual = Money.Add(totalPaid.Value,
            ResidualValue);
        if (totalWithResidual.IsFailure)
            return Result.Failure<Money>(totalWithResidual.Error);

        return Money.Subtract(totalWithResidual.Value, Amount);
    }

    public Result<Money> ApplyDiscount(decimal discountPercentage)
    {
        if (discountPercentage <= 0 || discountPercentage > 50)
            return
                Result.Failure<Money>(FinancingSimulationErrors.InvalidDiscount);

        var reductionResult = Money.Multiply(MonthlyPayment,
            discountPercentage / 100m);
        if (reductionResult.IsFailure)
            return Result.Failure<Money>(reductionResult.Error);

        var newPaymentResult = Money.Subtract(MonthlyPayment,
            reductionResult.Value);
        if (newPaymentResult.IsFailure)
            return Result.Failure<Money>(newPaymentResult.Error);

        MonthlyPayment = newPaymentResult.Value;

        Raise(new DiscountAppliedEvent(Id, discountPercentage,
            MonthlyPayment));

        return Result.Success(MonthlyPayment);
    }

    public Result<AmortizationSchedule> GenerateSchedule()
    {
        var capitalResult = Money.Subtract(Amount, ResidualValue);
        if (capitalResult.IsFailure)
            return
                Result.Failure<AmortizationSchedule>(capitalResult.Error);

        return AmortizationSchedule.Generate(capitalResult.Value,
            Rate, NumberOfInstallments);
    }
}

public class DiscountAppliedEvent : DomainEvent
{
    public Guid SimulationId { get; }
    public decimal DiscountPercentage { get; }
    public Money NewMonthlyPayment { get; }

    public DiscountAppliedEvent(
        Guid simulationId,
        decimal discountPercentage,
        Money newMonthlyPayment)
    {
        SimulationId = simulationId;
        DiscountPercentage = discountPercentage;
        NewMonthlyPayment = newMonthlyPayment;
    }
}

public static class FinancingSimulationErrors
{
    public static readonly Error EmptySimulationCode =
        Error.Failure(
            "FinancingSimulation.EmptyCode",
            "Simulation code is required.");

    public static readonly Error InvalidDiscount = Error.Failure(
        "FinancingSimulation.InvalidDiscount",
        "Discount must be between 0% and 50%.");
}