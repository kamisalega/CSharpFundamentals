using SalegaTech.Common.Domain;
using SalegaTech.Domain.Enums;

namespace SalegaTech.Domain.Entities;

public sealed class CreditFile : Entity
{
    public Guid Id { get; private set; }
    public string FileCode { get; private set; } = string.Empty;
    public FinancingSimulation Simulation { get; private set; } =
        null!;
    public Partner Partner { get; private set; } = null!;
    public SimulationStatus Status { get; private set; }
    public DateOnly CreatedDate { get; private set; }

    private CreditFile() { }

    public static Result<CreditFile> Create(
        string fileCode,
        FinancingSimulation simulation,
        Partner partner,
        DateOnly createdDate)
    {
        if (string.IsNullOrWhiteSpace(fileCode))
            return
                Result.Failure<CreditFile>(CreditFileErrors.EmptyFileCode);

        return new CreditFile
        {
            Id = Guid.NewGuid(),
            FileCode = fileCode,
            Simulation = simulation,
            Partner = partner,
            Status = SimulationStatus.Pending,
            CreatedDate = createdDate
        };
    }

    public Result Approve()
    {
        if (!Simulation.IsEligible())
            return Result.Failure(CreditFileErrors.NotEligible);

        Status = SimulationStatus.Approved;
        Raise(new CreditFileApprovedEvent(Id, FileCode));
        return Result.Success();
    }

    public Result Reject()
    {
        Status = SimulationStatus.Rejected;
        return Result.Success();
    }
}

public static class CreditFileErrors
{
    public static readonly Error EmptyFileCode = Error.Failure(
        "CreditFile.EmptyFileCode", "File code is required.");

    public static readonly Error NotEligible = Error.Failure(
        "CreditFile.NotEligible", "Cannot approve a credit file with ineligible simulation.");
}

public sealed class CreditFileApprovedEvent : DomainEvent
{
    public Guid CreditFileId { get; }
    public string FileCode { get; }

    public CreditFileApprovedEvent(Guid creditFileId, string
        fileCode)
    {
        CreditFileId = creditFileId;
        FileCode = fileCode;
    }
}

