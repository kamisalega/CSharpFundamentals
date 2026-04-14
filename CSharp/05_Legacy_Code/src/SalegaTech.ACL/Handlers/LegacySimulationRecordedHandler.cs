using Microsoft.Extensions.Logging;
using SalegaTech.ACL.Mappers;
using SalegaTech.Domain.Interfaces;
using SalegaTech.Legacy.Events;

namespace SalegaTech.ACL.Handlers;

public static class LegacySimulationRecordedHandler
{
    public static async Task HandleAsync(
        LegacySimulationRecordedEvent evt,
        IModernSimulationRepository modernRepo,
        ILogger<LegacySimulationRecordedHandlerLog> logger,
        CancellationToken ct)
    {
        logger.LogInformation("Consuming LegacySimulationRecordedEvent {CdeDossier}", evt.CdeDossier);

        var mappingResult = SimulationMapper.ToDomain(evt);
        if (mappingResult.IsFailure)
        {
            logger.LogWarning("Mapping failed for {CdeDossier}: {Error}",
                evt.CdeDossier, mappingResult.Error.Description);
            return;
        }

   
        var existing = await modernRepo.GetByCodeAsync(mappingResult.Value.SimulationCode, ct);
        if (existing is not null)
        {
            logger.LogInformation("Simulation {Code} already projected, skipping",
                mappingResult.Value.SimulationCode);
            return;
        }

        await modernRepo.AddAsync(mappingResult.Value, ct);
        logger.LogInformation("Projected simulation {Code} to modern.db",
            mappingResult.Value.SimulationCode);
    }
}

public sealed class LegacySimulationRecordedHandlerLog { }

