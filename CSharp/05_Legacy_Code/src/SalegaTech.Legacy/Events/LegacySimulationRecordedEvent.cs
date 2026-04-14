namespace SalegaTech.Legacy.Events;

public sealed record LegacySimulationRecordedEvent(
    string CdeDossier,
    string CdePartenaire,
    decimal MntFinancement,
    int TxInteret,
    int NbrEcheances,
    decimal MntVr,
    decimal MntMensualite,
    int CdeType,
    int CdeStatut,
    string DtSimulation);