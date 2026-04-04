using Evently.Common.Domain;

namespace Evently.IntegrationTests.Abstractions;
internal static class Poller
{
    private static readonly Error Timeout = Error.Failure("Poller.Timeout", "The poller has time out");
    public static async Task<Result<T>> WaitAsync<T>(TimeSpan timeout, Func<Task<Result<T>>> action)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        DateTime endTime = DateTime.UtcNow.Add(timeout);

        while (DateTime.UtcNow < endTime && await timer.WaitForNextTickAsync())
        {
            Result<T> result = await action();

            if (result.IsSuccess)
            {
                return result;
            }
        }

        return Result.Failure<T>(Timeout);
    }
}
