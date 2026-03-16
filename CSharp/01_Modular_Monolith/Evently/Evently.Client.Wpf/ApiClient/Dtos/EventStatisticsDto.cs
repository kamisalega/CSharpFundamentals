namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record EventStatisticsDto(
    Guid EventId,
    string Title,
    string Location,
    DateTime StartsAtUtc,
    int TicketsSold,
    int AttendeesCheckedIn);
