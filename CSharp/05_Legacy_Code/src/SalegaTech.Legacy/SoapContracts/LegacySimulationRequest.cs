using System.Runtime.Serialization;

namespace SalegaTech.Legacy.SoapContracts
{
    [DataContract(Namespace = "http://legacy.salega.tech/")]
    public sealed class LegacySimulationRequest
    {
        [DataMember] public string CDE_PARTENAIRE { get; set; } = default!;
        [DataMember] public decimal MNT_FINANCEMENT { get; set; }
        [DataMember] public int NBR_ECHEANCES { get; set; }
        [DataMember] public decimal MNT_VR { get; set; }
        [DataMember] public int CDE_TYPE { get; set; }
    }
}
