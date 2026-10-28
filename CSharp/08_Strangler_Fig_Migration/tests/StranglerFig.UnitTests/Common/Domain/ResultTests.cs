using Shouldly;
using StranglerFig.Common.Domain;

namespace StranglerFig.UnitTests.Common.Domain;

public sealed class ResultTests
{
    private static readonly Error SomeError = Error.Failure("Test.Error", "Something went wrong");

    [Fact]
    public void Success_IsSuccess_WithoutError()
    {
        var result = Result.Success();

        result.IsSuccess.ShouldBeTrue();
        result.IsFailure.ShouldBeFalse();
        result.Error.ShouldBe(Error.None);
    }

    [Fact]
    public void Failure_IsFailure_WithTheError()
    {
        var result = Result.Failure(SomeError);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(SomeError);
    }

    [Fact]
    public void Constructor_RejectsInconsistentState()
    {
        Should.Throw<ArgumentException>(() => new Result(true, SomeError));
        Should.Throw<ArgumentException>(() => new Result(false, Error.None));
    }

    [Fact]
    public void SuccessWithValue_ExposesTheValue()
    {
        var result = Result.Success(42);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(42);
    }

    [Fact]
    public void FailureWithValue_ThrowsWhenTheValueIsRead()
    {
        var result = Result.Failure<int>(SomeError);

        Should.Throw<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void ImplicitConversion_FromNull_IsANullValueFailure()
    {
        string? nothing = null;

        Result<string> result = nothing;

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(Error.NullValue);
    }
}
