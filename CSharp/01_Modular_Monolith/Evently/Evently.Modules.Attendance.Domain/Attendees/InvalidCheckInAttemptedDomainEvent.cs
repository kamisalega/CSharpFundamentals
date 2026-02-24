using Evently.Common.Domain;

namespace Evently.Modules.Attendance.Domain.Attendees;

internal sealed class InvalidCheckInAttemptedDomainEvent(
    Guid attendeeId,
    Guid eventId,
    Guid ticketId,
    string ticketCode) : DomainEvent
{
    public Guid AttendeeId { get; set; } = attendeeId;
    public Guid EventId { get; set; } = eventId;
    public Guid TicketId { get; set; } = ticketId;
    public string TicketCode { get; set; } = ticketCode;
}
