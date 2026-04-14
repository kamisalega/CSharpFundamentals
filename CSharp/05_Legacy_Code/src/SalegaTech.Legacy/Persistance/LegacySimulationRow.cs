namespace SalegaTech.Legacy.Persistance;

public sealed class LegacySimulationRow
{
    public int Id { get; set; }
    public string CDE_DOSSIER { get; set; } = default!;
    public string CDE_PARTENAIRE { get; set; } = default!;
    public decimal MNT_FINANCEMENT { get; set; }   // w centymach (1500000 = 15000€)
    public int TX_INTERET { get; set; }             // centièmes (499 = 4.99%)
    public int NBR_ECHEANCES { get; set; }
    public decimal MNT_VR { get; set; }             // valeur résiduelle (centy)
    public decimal MNT_MENSUALITE { get; set; }     // centy
    public int CDE_TYPE { get; set; }               // 1=LOA, 2=CLASSIC, 3=LLD
    public int CDE_STATUT { get; set; }             // 0=KO, 1=OK, 2=PENDING
    public string DT_SIMULATION { get; set; } = default!;   // "yyyyMMdd"
    public string? MSG_ERREUR { get; set; }
}