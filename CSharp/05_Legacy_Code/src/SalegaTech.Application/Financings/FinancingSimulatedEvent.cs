using SalegaTech.Common.Application.EventBus;

namespace SalegaTech.Application.Financings;

public record FinancingSimulatedEvent(
    Guid SimulationId,
    string SimulationCode,
    bool IsSuccess,
    string? ErrorMessage
) : IIntegrationEvent;