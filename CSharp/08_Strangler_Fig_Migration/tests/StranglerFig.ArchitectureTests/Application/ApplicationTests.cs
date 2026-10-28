using FluentValidation;
using NetArchTest.Rules;
using StranglerFig.ArchitectureTests.Abstractions;
using StranglerFig.Common.Application.Messaging;

namespace StranglerFig.ArchitectureTests.Application;

// Evently's conventions for the Application layer.
public sealed class ApplicationTests : BaseTest
{
    [Fact]
    public void Command_Should_BeSealed_AndEndWithCommand() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .That().ImplementInterface(typeof(ICommand)).Or().ImplementInterface(typeof(ICommand<>))
            .Should().BeSealed().And().HaveNameEndingWith("Command")
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void CommandHandler_Should_BeInternalSealed_AndEndWithCommandHandler() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .That().ImplementInterface(typeof(ICommandHandler<>)).Or().ImplementInterface(typeof(ICommandHandler<,>))
            .Should().NotBePublic().And().BeSealed().And().HaveNameEndingWith("CommandHandler")
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void Query_Should_BeSealed_AndEndWithQuery() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .That().ImplementInterface(typeof(IQuery<>))
            .Should().BeSealed().And().HaveNameEndingWith("Query")
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void QueryHandler_Should_BeInternalSealed_AndEndWithQueryHandler() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .That().ImplementInterface(typeof(IQueryHandler<,>))
            .Should().NotBePublic().And().BeSealed().And().HaveNameEndingWith("QueryHandler")
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void Validator_Should_BeInternalSealed_AndEndWithValidator() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .That().Inherit(typeof(AbstractValidator<>))
            .Should().NotBePublic().And().BeSealed().And().HaveNameEndingWith("Validator")
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void DomainEventHandler_Should_BeInternalSealed_AndEndWithDomainEventHandler() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .That().ImplementInterface(typeof(IDomainEventHandler<>)).Or().Inherit(typeof(DomainEventHandler<>))
            .Should().NotBePublic().And().BeSealed().And().HaveNameEndingWith("DomainEventHandler")
            .GetResult()
            .ShouldBeSuccessful();
}
