using CoreWCF;

namespace SalegaTech.Legacy.SoapContracts;

[ServiceContract(Namespace = "http://legacy.salega.tech/")]
public interface ILegacySimulationSoapService
{
    [OperationContract]
    Task<LegacySimulationResponse> SimulerAsync(LegacySimulationRequest request);
}