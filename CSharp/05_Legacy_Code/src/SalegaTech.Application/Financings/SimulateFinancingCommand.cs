namespace SalegaTech.Application.Financings
{
    public record SimulateFinancingCommand(
        Guid SimulationId,
        decimal Amount,
        int NumberOfMonths,
        string FinancingType,
        decimal ResidualValue,
        string PartnerCode
    );
}
