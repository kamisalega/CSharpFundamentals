using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using StranglerFig.Common.Application;
using StranglerFig.Common.Application.Exceptions;
using StranglerFig.Common.Application.Messaging;
using StranglerFig.Common.Domain;

namespace StranglerFig.UnitTests.Common.Application;

// AddApplication wires MediatR the way every module uses it. The commands below live in this test assembly.
public sealed class MediatorPipelineTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task ValidCommand_ReachesItsHandler()
    {
        using ServiceProvider services = CreateServices();

        Result<string> result = await services.GetRequiredService<ISender>().Send(new GreetCommand("Kamil"), Ct);

        result.Value.ShouldBe("Hello Kamil");
    }

    [Fact]
    public async Task InvalidCommand_ReturnsAValidationFailure_InsteadOfCallingTheHandler()
    {
        using ServiceProvider services = CreateServices();

        Result<string> result = await services.GetRequiredService<ISender>().Send(new GreetCommand(string.Empty), Ct);

        result.IsFailure.ShouldBeTrue();
        ValidationError error = result.Error.ShouldBeOfType<ValidationError>();
        error.Type.ShouldBe(ErrorType.Validation);
        error.Errors.ShouldHaveSingleItem().Code.ShouldBe("NotEmptyValidator");
    }

    [Fact]
    public async Task InvalidCommandWithoutValue_ReturnsAValidationFailure()
    {
        using ServiceProvider services = CreateServices();

        Result result = await services.GetRequiredService<ISender>().Send(new RenameCommand(string.Empty), Ct);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeOfType<ValidationError>();
    }

    [Fact]
    public async Task UnhandledException_IsWrappedInStranglerFigException()
    {
        using ServiceProvider services = CreateServices();

        StranglerFigException exception = await Should.ThrowAsync<StranglerFigException>(
            () => services.GetRequiredService<ISender>().Send(new ExplodeCommand(), Ct));

        exception.RequestName.ShouldBe(nameof(ExplodeCommand));
        exception.InnerException.ShouldBeOfType<InvalidOperationException>();
    }

    private static ServiceProvider CreateServices() =>
        new ServiceCollection()
            .AddLogging()
            .AddApplication([typeof(MediatorPipelineTests).Assembly])
            .BuildServiceProvider();
}

public sealed record GreetCommand(string Name) : ICommand<string>;

internal sealed class GreetCommandHandler : ICommandHandler<GreetCommand, string>
{
    public Task<Result<string>> Handle(GreetCommand request, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Success($"Hello {request.Name}"));
}

internal sealed class GreetCommandValidator : AbstractValidator<GreetCommand>
{
    public GreetCommandValidator() => RuleFor(c => c.Name).NotEmpty();
}

public sealed record RenameCommand(string NewName) : ICommand;

internal sealed class RenameCommandHandler : ICommandHandler<RenameCommand>
{
    public Task<Result> Handle(RenameCommand request, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Success());
}

internal sealed class RenameCommandValidator : AbstractValidator<RenameCommand>
{
    public RenameCommandValidator() => RuleFor(c => c.NewName).NotEmpty();
}

public sealed record ExplodeCommand : ICommand;

internal sealed class ExplodeCommandHandler : ICommandHandler<ExplodeCommand>
{
    public Task<Result> Handle(ExplodeCommand request, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("Boom");
}
