using Evently.Common.Application.Clock;

namespace Evently.Modules.Events.Infrastructure.Clock;
internal sealed class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
