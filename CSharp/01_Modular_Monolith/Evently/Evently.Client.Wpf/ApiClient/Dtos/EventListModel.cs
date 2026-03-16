namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record EventListModel(
    IReadOnlyList<EventDto> Events,
    string SearchTerm,
    int Page,
    int PageSize,
    int TotalCount,
    bool IsLoading,
    string? Error)
{
    public static EventListModel Empty => new(
        Events: [],
        SearchTerm: "",
        Page: 1,
        PageSize: 10,
        TotalCount: 0,
        IsLoading: false,
        Error: null);
}
