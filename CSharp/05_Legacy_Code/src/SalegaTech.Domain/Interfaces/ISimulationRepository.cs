using SalegaTech.Domain.Entities;

namespace SalegaTech.Domain.Interfaces
{
    public interface IModernSimulationRepository
    {
        Task<FinancingSimulation?> GetByCodeAsync(string simulationCode, CancellationToken cancellation = default);
        Task AddAsync(FinancingSimulation simulation, CancellationToken cancellation = default);
    }
}
