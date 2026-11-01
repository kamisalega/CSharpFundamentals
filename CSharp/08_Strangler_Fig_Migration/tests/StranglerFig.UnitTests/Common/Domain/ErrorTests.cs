using Shouldly;
using StranglerFig.Common.Domain;

namespace StranglerFig.UnitTests.Common.Domain;

public sealed class ErrorTests
{
    [Fact]
    public void Factories_SetTheErrorType()
    {
        Error.Failure("Code", "Description").Type.ShouldBe(ErrorType.Failure);
        Error.NotFound("Code", "Description").Type.ShouldBe(ErrorType.NotFound);
        Error.Problem("Code", "Description").Type.ShouldBe(ErrorType.Problem);
        Error.Conflict("Code", "Description").Type.ShouldBe(ErrorType.Conflict);
    }
}
