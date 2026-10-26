using NetArchTest.Rules;
using StranglerFig.ArchitectureTests.Abstractions;

namespace StranglerFig.ArchitectureTests.Boundaries;

// The article: "communicate through events or APIs" and don't read each other's data.
// These rules keep the temporary migration code deletable and the new module clean.
public sealed class StranglerFigBoundaryTests : BaseTest
{
    [Fact]
    public void OrdersModule_ShouldNotDependOn_MigrationCode_ExceptItsIntegrationEvents() =>
        Types.InAssemblies(OrdersModuleAssemblies)
            .That()
            .DoNotHaveDependencyOn(MigrationIntegrationEventsNamespace)
            .Should()
            .NotHaveDependencyOn(MigrationNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void OrdersDomainAndApplication_ShouldNotKnow_AboutTheMigrationAtAll() =>
        Types.InAssemblies([OrdersDomainAssembly, OrdersApplicationAssembly])
            .Should()
            .NotHaveDependencyOn(MigrationNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void OnlyPresentationHandlers_And_InboxWiring_UseMigrationIntegrationEvents() =>
        Types.InAssemblies(OrdersModuleAssemblies)
            .That()
            .HaveDependencyOn(MigrationIntegrationEventsNamespace)
            .Should()
            .ResideInNamespace(OrdersPresentationNamespace)
            .Or()
            .ResideInNamespace(OrdersInfrastructureNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void MigrationCode_ShouldReachOrdersModule_OnlyThroughPublicApi() =>
        Types.InAssemblies([MigrationAssembly, MigrationIntegrationEventsAssembly])
            .Should()
            .NotHaveDependencyOnAny(
                OrdersDomainNamespace,
                OrdersApplicationNamespace,
                OrdersInfrastructureNamespace,
                OrdersPresentationNamespace)
            .GetResult()
            .ShouldBeSuccessful();

    [Fact]
    public void CommonCode_ShouldNotDependOn_ModulesOrMigration() =>
        Types.InAssemblies(CommonAssemblies)
            .Should()
            .NotHaveDependencyOnAny(OrdersNamespace, MigrationNamespace)
            .GetResult()
            .ShouldBeSuccessful();
}
