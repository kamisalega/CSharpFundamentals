using SalegaTech.Application.Abstractions;
using SalegaTech.Application.Financings;
using System.Collections.Concurrent;

namespace SalegaTech.Infrastructure.Store;

public class InMemorySimulationResultStore : ISimulationResultStore
{
    private readonly ConcurrentDictionary<Guid, SimulationResponse> _store = new();

    public Task SaveAsync(Guid simulationId, SimulationResponse response, CancellationToken ct = default)
    {
        _store.AddOrUpdate(simulationId, response, (_, _) => response);
        return Task.CompletedTask;
    }

    public Task<SimulationResponse?> GetAsync(Guid simulationId, CancellationToken ct = default)
    {
        _store.TryGetValue(simulationId, out var response);
        return Task.FromResult(response);
    }
}