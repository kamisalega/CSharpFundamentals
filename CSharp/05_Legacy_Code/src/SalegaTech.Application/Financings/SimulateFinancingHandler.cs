using SalegaTech.Application.Abstractions;
using SalegaTech.Application.Events;
using SalegaTech.Common.Domain;
using SalegaTech.Domain.Entities;
using SalegaTech.Domain.Enums;
using SalegaTech.Domain.Interfaces;
using SalegaTech.Domain.Services;
using SalegaTech.Domain.ValueObjects;
using Wolverine;

namespace SalegaTech.Application.Financings;

public static class SimulateFinancingHandler
{
    public static async Task HandleAsync(
          SimulateFinancingCommand command,
          IModernSimulationRepository repo,
          ISimulationResultStore store,
          IMessageBus bus,
          CancellationToken ct)
    {
        var amount = Money.Create(command.Amount).Value;
        var residual = Money.Create(command.ResidualValue).Value;
        var rate = AnnuityCalculator.GetDefaultRate().Value;
        var monthly = AnnuityCalculator.ComputeMonthlyPayment(amount, rate, command.NumberOfMonths, residual).Value;

        var type = command.FinancingType?.ToUpperInvariant() switch
        {
            "LOA" => FinancingType.LOA,
            "CC" or "CLASSIC" or "CLASSICCREDIT" => FinancingType.ClassicCredit,
            "LLD" => FinancingType.LLD,
            _ => FinancingType.LOA
        };

        var simulationCode = $"SIM-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}"[..16];
        var simulationDate = DateOnly.FromDateTime(DateTime.UtcNow);

        var simulation = FinancingSimulation.Create(
            simulationCode, amount, residual, monthly, rate,
            command.NumberOfMonths, type, simulationDate).Value;

        var existing = await repo.GetByCodeAsync(simulation.SimulationCode, ct);
        if (existing is null)
            await repo.AddAsync(simulation, ct);

        var totalCost = simulation.CalculateTotalCost().Value.Value;

        var response = new SimulationResponse(
            SimulationId: command.SimulationId.ToString(),
            SimulationCode: simulation.SimulationCode,
            Status: simulation.IsEligible() ? "Approved" : "Pending",
            Amount: simulation.Amount.Value,
            ResidualValue: simulation.ResidualValue.Value,
            MonthlyPayment: simulation.MonthlyPayment.Value,
            InterestRatePercentage: simulation.Rate.ValueAsPercentage,
            NumberOfInstallments: simulation.NumberOfInstallments,
            FinancingType: simulation.Type.ToString(),
            PartnerCode: command.PartnerCode,
            PartnerLabel: "",
            TotalCost: totalCost,
            SimulationDate: simulation.SimulationDate.ToString("yyyy-MM-dd"),
            ErrorMessage: null);

        await store.SaveAsync(command.SimulationId, response, ct);

        var integration = new ModernSimulationCreatedEvent(
            SimulationId: command.SimulationId,
            SimulationCode: simulation.SimulationCode,
            Amount: simulation.Amount.Value,
            Currency: simulation.Amount.Currency,
            ResidualValue: simulation.ResidualValue.Value,
            MonthlyPayment: simulation.MonthlyPayment.Value,
            InterestRatePercentage: simulation.Rate.ValueAsPercentage,
            NumberOfInstallments: simulation.NumberOfInstallments,
            FinancingType: simulation.Type.ToString(),
            PartnerCode: command.PartnerCode,
            SimulationDate: simulation.SimulationDate);

        await bus.PublishAsync(integration);
    }
}