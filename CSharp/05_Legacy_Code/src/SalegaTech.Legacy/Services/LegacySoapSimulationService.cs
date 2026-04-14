using Microsoft.Extensions.Logging;
using SalegaTech.Legacy.Repositories;
using SalegaTech.Legacy.SoapContracts;
using Wolverine;

namespace SalegaTech.Legacy.Services;

public sealed class LegacySoapSimulationService 
{
    private readonly ILegacySimulationRepository _repo;
    private readonly IMessageBus _bus;
    private readonly ILogger<LegacySoapSimulationService> _logger;

    public LegacySoapSimulationService(
        ILegacySimulationRepository repo,
        IMessageBus bus,
        ILogger<LegacySoapSimulationService> logger)
    {
        _repo = repo;
        _bus = bus;
        _logger = logger;
    }

    public LegacySimulationResponse Simulate(LegacySimulationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CDE_PARTENAIRE))
            return Ko("Partenaire inconnu");
        if (request.MNT_FINANCEMENT < 3000m || request.MNT_FINANCEMENT > 75000m)
            return Ko("Montant hors limites");
        if (request.NBR_ECHEANCES < 12 || request.NBR_ECHEANCES > 84)
            return Ko("Durée invalide");

        const int txInteretCentiemes = 499;
        var monthlyRate = (txInteretCentiemes / 10000m) / 12m;
        var capital = request.MNT_FINANCEMENT - request.MNT_VR;
        var pow = (decimal)Math.Pow(1 + (double)monthlyRate, request.NBR_ECHEANCES);
        var mensualite = monthlyRate == 0m
            ? capital / request.NBR_ECHEANCES
            : capital * monthlyRate * pow / (pow - 1);
        mensualite = Math.Round(mensualite, 2, MidpointRounding.ToEven);

        return new LegacySimulationResponse
        {
            CDE_DOSSIER = $"DOS-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            CDE_STATUT = 1,
            MNT_MENSUALITE = mensualite * 100m,
            TX_INTERET = txInteretCentiemes,
            MNT_FINANCEMENT = request.MNT_FINANCEMENT * 100m,
            MNT_VR = request.MNT_VR * 100m,
            NBR_ECHEANCES = request.NBR_ECHEANCES,
            DT_SIMULATION = DateTime.UtcNow.ToString("yyyyMMdd"),
            CDE_PARTENAIRE = request.CDE_PARTENAIRE,
            LIB_PARTENAIRE = LookupLabel(request.CDE_PARTENAIRE)
        };
    }

    private static string LookupLabel(string code) => code?.ToUpperInvariant() switch
    {
        "CONC001" => "Concession Auto Prestige Paris",
        "DEALER01" => "Dealer Principal",
        _ => string.Empty
    };

    private static LegacySimulationResponse Ko(string msg) => new()
    {
        CDE_DOSSIER = string.Empty,
        CDE_STATUT = 0,
        MNT_MENSUALITE = 0m,
        TX_INTERET = 0,
        MSG_ERREUR = msg
    };
}