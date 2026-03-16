namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record SearchEventsResponse(
    int Page,
    int PageSize,
    int TotalCount,
    IReadOnlyList<EventDto> Events);
