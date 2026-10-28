using StranglerFig.Common.Domain;

namespace StranglerFig.Common.Application.Exceptions;

public sealed class StranglerFigException : Exception
{
    public StranglerFigException(string requestName, Error? error = default, Exception? innerException = default)
        : base("Application exception", innerException)
    {
        RequestName = requestName;
        Error = error;
    }

    public string RequestName { get; }

    public Error? Error { get; }
}
