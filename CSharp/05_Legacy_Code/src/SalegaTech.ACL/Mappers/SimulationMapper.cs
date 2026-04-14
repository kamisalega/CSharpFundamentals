using SalegaTech.ACL.Translators;
using SalegaTech.Application.Events;
using SalegaTech.Common.Domain;
using SalegaTech.Domain.Entities;
using SalegaTech.Legacy.Events;
using SalegaTech.Legacy.Persistence;
using SalegaTech.Legacy.SoapContracts;

namespace SalegaTech.ACL.Mappers;

public static class SimulationMapper
{
    public static Result<FinancingSimulation> ToDomain(LegacySimulationResponse legacy)
    {
        if (legacy.CDE_STATUT == 0)
        {
            return Result.Failure<FinancingSimulation>(SimulationMapperErrors.LegacyError(legacy.MSG_ERREUR));
        }


        var amountResult = AmountTranslator.ToMoney(legacy.MNT_FINANCEMENT);
        if (amountResult.IsFailure)
            return Result.Failure<FinancingSimulation>(amountResult.Error);

        var residualValueResult = AmountTranslator.ToMoney(legacy.MNT_VR);
        if (residualValueResult.IsFailure)
            return Result.Failure<FinancingSimulation>(residualValueResult.Error);

        var monthlyPaymentResult = AmountTranslator.ToMoney(legacy.MNT_MENSUALITE);
        if (monthlyPaymentResult.IsFailure)
            return Result.Failure<FinancingSimulation>(monthlyPaymentResult.Error);

        var rateResult = LegacyFieldTranslator.RateFromHundredths(legacy.TX_INTERET);
        if (rateResult.IsFailure)
            return Result.Failure<FinancingSimulation>(rateResult.Error);

        var dateResult = LegacyFieldTranslator.DateFromYyyyMmDd(legacy.DT_SIMULATION);
        if (dateResult.IsFailure)
            return Result.Failure<FinancingSimulation>(dateResult.Error);


        var type = Domain.Enums.FinancingType.LOA;


        return FinancingSimulation.Create(
            simulationCode: legacy.CDE_DOSSIER,
            amount: amountResult.Value,
            residualValue: residualValueResult.Value,
            monthlyPayment: monthlyPaymentResult.Value,
            rate: rateResult.Value,
            numberOfInstallments: legacy.NBR_ECHEANCES,
            type: type,
            simulationDate: dateResult.Value
        );
    }

    public static Result<FinancingSimulation> ToDomain(LegacySimulationRecordedEvent evt)
    {
        if (evt.CdeStatut == 0)
            return Result.Failure<FinancingSimulation>(
                SimulationMapperErrors.LegacyError("Legacy KO status"));

        var amountResult = AmountTranslator.ToMoney(evt.MntFinancement);
        if (amountResult.IsFailure)
            return Result.Failure<FinancingSimulation>(amountResult.Error);

        var residualResult = AmountTranslator.ToMoney(evt.MntVr);
        if (residualResult.IsFailure)
            return Result.Failure<FinancingSimulation>(residualResult.Error);

        var paymentResult = AmountTranslator.ToMoney(evt.MntMensualite);
        if (paymentResult.IsFailure)
            return Result.Failure<FinancingSimulation>(paymentResult.Error);

        var rateResult = LegacyFieldTranslator.RateFromHundredths(evt.TxInteret);
        if (rateResult.IsFailure)
            return Result.Failure<FinancingSimulation>(rateResult.Error);

        var dateResult = LegacyFieldTranslator.DateFromYyyyMmDd(evt.DtSimulation);
        if (dateResult.IsFailure)
            return Result.Failure<FinancingSimulation>(dateResult.Error);

        var type = evt.CdeType switch
        {
            1 => Domain.Enums.FinancingType.LOA,
            2 => Domain.Enums.FinancingType.ClassicCredit,
            3 => Domain.Enums.FinancingType.LLD,
            _ => Domain.Enums.FinancingType.LOA
        };

        return FinancingSimulation.Create(
            simulationCode: evt.CdeDossier,
            amount: amountResult.Value,
            residualValue: residualResult.Value,
            monthlyPayment: paymentResult.Value,
            rate: rateResult.Value,
            numberOfInstallments: evt.NbrEcheances,
            type: type,
            simulationDate: dateResult.Value);
    }

    public static LegacySimulationRow ToLegacyRow(ModernSimulationCreatedEvent evt)
    {
        return new LegacySimulationRow
        {
            CDE_DOSSIER = evt.SimulationCode,
            CDE_PARTENAIRE = evt.PartnerCode,
            MNT_FINANCEMENT = evt.Amount,
            MNT_VR = evt.ResidualValue,
            MNT_MENSUALITE = evt.MonthlyPayment,
            TX_INTERET = (int)Math.Round(evt.InterestRatePercentage * 100m, MidpointRounding.AwayFromZero),
            NBR_ECHEANCES = evt.NumberOfInstallments,
            CDE_TYPE = evt.FinancingType?.ToUpperInvariant() switch
            {
                "LOA" => 1,
                "CLASSICCREDIT" => 2,
                "LLD" => 3,
                _ => 1
            },
            CDE_STATUT = 1,
            DT_SIMULATION = evt.SimulationDate.ToString("yyyyMMdd"),
            MSG_ERREUR = null
        };
    }
}

public static class SimulationMapperErrors
{
    public static Error LegacyError(string legacyMessage) => Error.Failure(
        "Legacy.SimulationFailed",
        string.IsNullOrWhiteSpace(legacyMessage)
            ? "Legacy system returned a failure without message."
            : $"Legacy system error: {legacyMessage}");
}