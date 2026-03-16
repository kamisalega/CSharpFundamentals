namespace Evently.Client.Wpf.ApiClient.Dtos;

public sealed record EventDetailModel(
    EventDto? Event,
    IReadOnlyList<TicketTypeDto> TicketTypes,
    bool IsLoading,
    string? Error)
{
    public static EventDetailModel Empty => new(null, [], false, null);
}
