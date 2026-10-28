using Shouldly;
using StranglerFig.Common.Domain;
using StranglerFig.Common.Presentation.Results;

namespace StranglerFig.UnitTests.Common.Presentation;

public sealed class ResultExtensionsTests
{
    [Fact]
    public void Match_CallsTheBranchThatFitsTheResult()
    {
        Result.Success().Match(() => "ok", _ => "failed").ShouldBe("ok");
        Result.Failure(Error.NullValue).Match(() => "ok", _ => "failed").ShouldBe("failed");

        Result.Success(2).Match(value => value * 10, _ => -1).ShouldBe(20);
        Result.Failure<int>(Error.NullValue).Match(value => value * 10, _ => -1).ShouldBe(-1);
    }
}
