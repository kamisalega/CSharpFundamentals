using System.Runtime.Serialization;

namespace SalegaTech.Legacy.SoapContracts;

[DataContract(Namespace = "http://legacy.salega.tech/")]
public class LegacySimulationResponse
{
    [DataMember] public string CDE_DOSSIER { get; set; } = default!;
    [DataMember] public int CDE_STATUT { get; set; }
    [DataMember] public decimal MNT_FINANCEMENT { get; set; }
    [DataMember] public decimal MNT_VR { get; set; }
    [DataMember] public decimal MNT_MENSUALITE { get; set; }
    [DataMember] public int TX_INTERET { get; set; }
    [DataMember] public int NBR_ECHEANCES { get; set; }
    [DataMember] public string DT_SIMULATION { get; set; } = default!;
    [DataMember] public string? CDE_PARTENAIRE { get; set; }
    [DataMember] public string? LIB_PARTENAIRE { get; set; }
    [DataMember] public string? MSG_ERREUR { get; set; }
}