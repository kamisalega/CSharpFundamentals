namespace SalegaTech.Application.Financings;

public sealed record SimulationResponse(
    string SimulationId,
    string SimulationCode,
    string Status,
    decimal Amount,
    decimal ResidualValue,
    decimal MonthlyPayment,
    decimal InterestRatePercentage,
    int NumberOfInstallments,
    string FinancingType,
    string PartnerCode,
    string PartnerLabel,
    decimal TotalCost,
    string SimulationDate,
    string? ErrorMessage
);