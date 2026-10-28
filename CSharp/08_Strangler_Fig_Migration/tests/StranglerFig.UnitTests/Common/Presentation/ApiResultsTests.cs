using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Shouldly;
using StranglerFig.Common.Domain;
using StranglerFig.Common.Presentation.Results;

namespace StranglerFig.UnitTests.Common.Presentation;

public sealed class ApiResultsTests
{
    [Theory]
    [InlineData(ErrorType.Validation, StatusCodes.Status400BadRequest)]
    [InlineData(ErrorType.Problem, StatusCodes.Status400BadRequest)]
    [InlineData(ErrorType.NotFound, StatusCodes.Status404NotFound)]
    [InlineData(ErrorType.Conflict, StatusCodes.Status409Conflict)]
    [InlineData(ErrorType.Failure, StatusCodes.Status500InternalServerError)]
    public void Problem_MapsTheErrorType_ToAStatusCode(ErrorType type, int statusCode)
    {
        IResult problem = ApiResults.Problem(Result.Failure(new Error("Test.Code", "Description", type)));

        problem.ShouldBeOfType<ProblemHttpResult>().StatusCode.ShouldBe(statusCode);
    }

    [Fact]
    public void Problem_ForAValidationError_ListsEveryError()
    {
        var error = new ValidationError([Error.Problem("Name", "Name is required")]);

        IResult problem = ApiResults.Problem(Result.Failure(error));

        problem.ShouldBeOfType<ProblemHttpResult>().ProblemDetails.Extensions["errors"].ShouldBe(error.Errors);
    }

    [Fact]
    public void Problem_ForASuccess_Throws() =>
        Should.Throw<InvalidOperationException>(() => ApiResults.Problem(Result.Success()));
}
