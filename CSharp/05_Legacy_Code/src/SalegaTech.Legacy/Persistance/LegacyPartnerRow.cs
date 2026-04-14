namespace SalegaTech.Legacy.Persistance;

public sealed class LegacyPartnerRow
{
    public int Id { get; set; }
    public string CDE_PARTENAIRE { get; set; } = default!;
    public string LIB_PARTENAIRE { get; set; } = default!;
}