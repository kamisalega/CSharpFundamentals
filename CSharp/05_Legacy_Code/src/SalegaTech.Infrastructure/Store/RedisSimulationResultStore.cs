using System.Text.Json;
using SalegaTech.Application.Abstractions;
using SalegaTech.Application.Financings;
using StackExchange.Redis;

namespace SalegaTech.Infrastructure.Store;

public class RedisSimulationResultStore : ISimulationResultStore
{
    private readonly IConnectionMultiplexer _redis;
    private static readonly TimeSpan Expiry = TimeSpan.FromHours(24);

    public RedisSimulationResultStore(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task SaveAsync(Guid simulationId, SimulationResponse response, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var json = JsonSerializer.Serialize(response);
        await db.StringSetAsync($"simulation:{simulationId}", json, Expiry);
    }

    public async Task<SimulationResponse?> GetAsync(Guid simulationId, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var json = await db.StringGetAsync($"simulation:{simulationId}");

        if (json.IsNullOrEmpty)
            return null;

        return JsonSerializer.Deserialize<SimulationResponse>(json!);
    }
}