using Shouldly;

namespace StranglerFig.ArchitectureTests.Abstractions;

internal static class TestResultExtensions
{
    internal static void ShouldBeSuccessful(this NetArchTest.Rules.TestResult testResult) =>
        (testResult.FailingTypeNames ?? []).ShouldBeEmpty();
}
