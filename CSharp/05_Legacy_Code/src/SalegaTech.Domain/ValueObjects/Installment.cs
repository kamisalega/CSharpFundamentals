namespace SalegaTech.Domain.ValueObjects;

public record Installment(
    int Number,
    Money MonthlyPayment,
    Money Interest,
    Money PrincipalPortion,
    Money RemainingPrincipal
);