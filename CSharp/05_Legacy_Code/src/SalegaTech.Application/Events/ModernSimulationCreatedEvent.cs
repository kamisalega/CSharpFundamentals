using SalegaTech.Common.Application.EventBus;

namespace SalegaTech.Application.Events;

public sealed record ModernSimulationCreatedEvent(
    Guid SimulationId,
    string SimulationCode,
    decimal Amount,
    string Currency,
    decimal ResidualValue,
    decimal MonthlyPayment,
    decimal InterestRatePercentage,
    int NumberOfInstallments,
    string FinancingType,    
    string PartnerCode,
    DateOnly SimulationDate) : IIntegrationEvent;