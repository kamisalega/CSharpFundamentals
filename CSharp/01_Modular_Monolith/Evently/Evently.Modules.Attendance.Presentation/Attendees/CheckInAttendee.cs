using Evently.Common.Domain;
using Evently.Common.Presentation.ApiResults;
using Evently.Common.Presentation.Endpoints;
using Evently.Modules.Attendance.Application.Abstractions.Authentication;
using Evently.Modules.Attendance.Application.Attendees.CheckInAttendee;
using MassTransit;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Evently.Modules.Attendance.Presentation.Attendees;

internal sealed class CheckInAttendee : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("attendees/check-in", async (
                CheckInAttendeeRequest request,
                IAttendanceContext attendanceContext,
                ISender sender) =>
            {
                Result result = await sender.Send(
                    new CheckInAttendeeCommand(attendanceContext.AttendeeId, request.TicketId));

                return result.Match(Results.NoContent, ApiResults.Problem);
            })
            .RequireAuthorization(Permissions.CheckInTicket)
            .WithTags(Tags.Attendees);
    }

    internal sealed class CheckInAttendeeRequest
    {
        public Guid TicketId { get; init; }
    }
}
