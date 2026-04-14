using Microsoft.Extensions.Logging;
using SalegaTech.Legacy.Events;
using SalegaTech.Legacy.Persistence;
using SalegaTech.Legacy.Repositories;
using SalegaTech.Legacy.SoapContracts;
using Wolverine;

namespace SalegaTech.Legacy.Services;

public sealed class LegacySimulationSoapService : ILegacySimulationSoapService
{
    private readonly ILegacySimulationRepository _repo;
    private readonly IMessageBus _bus;
    private readonly ILogger<LegacySimulationSoapService> _logger;
    private readonly LegacySoapSimulationService _calculator;

    public LegacySimulationSoapService(
        ILegacySimulationRepository repo,
        IMessageBus bus,
        ILogger<LegacySimulationSoapService> logger,
        LegacySoapSimulationService calculator)
    {
        _repo = repo;
        _bus = bus;
        _logger = logger;
        _calculator = calculator;
    }

    public async Task<LegacySimulationResponse> SimulerAsync(LegacySimulationRequest request)
    {
        var response = _calculator.Simulate(request);

        if (response.CDE_STATUT == 0)
        {
            _logger.LogWarning("Legacy simulation KO for {Partner}: {Msg}",
                request.CDE_PARTENAIRE, response.MSG_ERREUR);
            return response;
        }

        var row = new LegacySimulationRow
        {
            CDE_DOSSIER = response.CDE_DOSSIER,
            CDE_PARTENAIRE = request.CDE_PARTENAIRE,
            MNT_FINANCEMENT = response.MNT_FINANCEMENT,
            TX_INTERET = response.TX_INTERET,
            NBR_ECHEANCES = response.NBR_ECHEANCES,
            MNT_VR = response.MNT_VR,
            MNT_MENSUALITE = response.MNT_MENSUALITE,
            CDE_TYPE = request.CDE_TYPE,
            CDE_STATUT = response.CDE_STATUT,
            DT_SIMULATION = response.DT_SIMULATION
        };
        await _repo.AddAsync(row);
        _logger.LogInformation("Legacy saved {CdeDossier}", response.CDE_DOSSIER);

        var evt = new LegacySimulationRecordedEvent(
            CdeDossier: row.CDE_DOSSIER,
            CdePartenaire: row.CDE_PARTENAIRE,
            MntFinancement: row.MNT_FINANCEMENT,
            TxInteret: row.TX_INTERET,
            NbrEcheances: row.NBR_ECHEANCES,
            MntVr: row.MNT_VR,
            MntMensualite: row.MNT_MENSUALITE,
            CdeType: row.CDE_TYPE,
            CdeStatut: row.CDE_STATUT,
            DtSimulation: row.DT_SIMULATION);

        await _bus.PublishAsync(evt);
        _logger.LogInformation("Published LegacySimulationRecordedEvent {CdeDossier}", row.CDE_DOSSIER);

        return response;
    }
}