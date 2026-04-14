using SalegaTech.Common.Domain;

namespace SalegaTech.Domain.Entities;

public class Partner : Entity
{
    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;

    private Partner() { }

    public static Result<Partner> Create(string code, string
        label)
    {
        if (string.IsNullOrWhiteSpace(code))
            return
                Result.Failure<Partner>(PartnerErrors.EmptyCode);

        if (string.IsNullOrWhiteSpace(label))
            return
                Result.Failure<Partner>(PartnerErrors.EmptyLabel);

        return new Partner
        {
            Id = Guid.NewGuid(),
            Code = code.Trim().ToUpperInvariant(),
            Label = label.Trim()
        };
    }

    public override string ToString() => $"{Code} - {Label}";
}

public static class PartnerErrors
{
    public static readonly Error EmptyCode = Error.Failure(
        "Partner.EmptyCode", "Partner code is required.");

    public static readonly Error EmptyLabel = Error.Failure(
        "Partner.EmptyLabel", "Partner label is required.");
}



