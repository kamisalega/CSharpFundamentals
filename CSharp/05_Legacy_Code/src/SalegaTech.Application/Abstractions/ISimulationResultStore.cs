using SalegaTech.Application.Financings;

namespace SalegaTech.Application.Abstractions;

public interface ISimulationResultStore
{
    Task SaveAsync(Guid simulationId, SimulationResponse response, CancellationToken cancellation = default);
    Task<SimulationResponse?> GetAsync(Guid simulationId, CancellationToken cancellation = default);
}