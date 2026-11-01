using NetArchTest.Rules;
using StranglerFig.ArchitectureTests.Abstractions;

namespace StranglerFig.ArchitectureTests.Layers;

// The same layer rules Evently has for each of its modules.
public sealed class LayerTests : BaseTest
{
    [Fact]
    public void DomainLayer_ShouldNotHaveDependencyOn_ApplicationLayer() =>
        Types.InAssembly(OrdersDomainAssembly)
            .Should()
            .NotHaveDependencyOn(OrdersApplicationNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void DomainLayer_ShouldNotHaveDependencyOn_InfrastructureLayer() =>
        Types.InAssembly(OrdersDomainAssembly)
            .Should()
            .NotHaveDependencyOn(OrdersInfrastructureNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void ApplicationLayer_ShouldNotHaveDependencyOn_InfrastructureLayer() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .Should()
            .NotHaveDependencyOn(OrdersInfrastructureNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void ApplicationLayer_ShouldNotHaveDependencyOn_PresentationLayer() =>
        Types.InAssembly(OrdersApplicationAssembly)
            .Should()
            .NotHaveDependencyOn(OrdersPresentationNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void PresentationLayer_ShouldNotHaveDependencyOn_InfrastructureLayer() =>
        Types.InAssembly(OrdersPresentationAssembly)
            .Should()
            .NotHaveDependencyOn(OrdersInfrastructureNamespace)
            .GetResult()
            .ShouldBeSuccessful();
}
