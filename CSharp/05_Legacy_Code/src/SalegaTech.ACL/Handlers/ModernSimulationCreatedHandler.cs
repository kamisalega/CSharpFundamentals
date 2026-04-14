using Microsoft.Extensions.Logging;
using SalegaTech.ACL.Mappers;
using SalegaTech.Application.Events;
using SalegaTech.Legacy.Repositories;

namespace SalegaTech.ACL.Handlers;

public static class ModernSimulationCreatedHandler
{
    public static async Task HandleAsync(
        ModernSimulationCreatedEvent evt,
        ILegacySimulationRepository legacyRepo,
        ILogger<ModernSimulationCreatedHandlerLog> logger,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(evt.SimulationCode))
        {
            logger.LogDebug("Skipping reverse sync for empty SimulationCode (SimulationId={Id})",
                evt.SimulationId);
            return;
        }

        logger.LogInformation("Reverse-projecting Modern → Legacy for {Code}", evt.SimulationCode);

        var existing = await legacyRepo.GetByDossierAsync(evt.SimulationCode, ct);
        if (existing is not null)
        {
            logger.LogInformation("Legacy row {Code} already exists, skipping", evt.SimulationCode);
            return;
        }

        var row = SimulationMapper.ToLegacyRow(evt);
        await legacyRepo.AddAsync(row, ct);

        logger.LogInformation("Mirrored {Code} to legacy.db (TX_INTERET={Tx}, MNT_FINANCEMENT={Amt})",
            row.CDE_DOSSIER, row.TX_INTERET, row.MNT_FINANCEMENT);
    }
}

public sealed class ModernSimulationCreatedHandlerLog { }