using System.Reflection;
using StranglerFig.Migration;
using StranglerFig.Migration.IntegrationEvents;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.Infrastructure;
using StranglerFig.Modules.Orders.IntegrationEvents;
using StranglerFig.Modules.Orders.PublicApi;

namespace StranglerFig.ArchitectureTests.Abstractions;

public abstract class BaseTest
{
    protected const string OrdersNamespace = "StranglerFig.Modules.Orders";
    protected const string OrdersDomainNamespace = "StranglerFig.Modules.Orders.Domain";
    protected const string OrdersApplicationNamespace = "StranglerFig.Modules.Orders.Application";
    protected const string OrdersInfrastructureNamespace = "StranglerFig.Modules.Orders.Infrastructure";
    protected const string OrdersPresentationNamespace = "StranglerFig.Modules.Orders.Presentation";
    protected const string MigrationNamespace = "StranglerFig.Migration";
    protected const string MigrationIntegrationEventsNamespace = "StranglerFig.Migration.IntegrationEvents";

    protected static readonly Assembly OrdersDomainAssembly = typeof(Order).Assembly;
    protected static readonly Assembly OrdersApplicationAssembly = Modules.Orders.Application.AssemblyReference.Assembly;
    protected static readonly Assembly OrdersInfrastructureAssembly = typeof(OrdersModule).Assembly;
    protected static readonly Assembly OrdersPresentationAssembly = Modules.Orders.Presentation.AssemblyReference.Assembly;
    protected static readonly Assembly OrdersPublicApiAssembly = typeof(IOrdersApi).Assembly;
    protected static readonly Assembly OrdersIntegrationEventsAssembly = typeof(OrderImportedIntegrationEvent).Assembly;

    protected static readonly Assembly MigrationAssembly = typeof(OrdersMigrationRegistration).Assembly;
    protected static readonly Assembly MigrationIntegrationEventsAssembly = typeof(LegacyOrderPlacedIntegrationEvent).Assembly;

    protected static readonly Assembly[] CommonAssemblies =
    [
        typeof(Common.Domain.Entity).Assembly,
        typeof(Common.Application.ApplicationConfiguration).Assembly,
        typeof(Common.Infrastructure.InfrastructureConfiguration).Assembly,
        typeof(Common.Presentation.Endpoints.IEndpoint).Assembly
    ];

    protected static readonly Assembly[] OrdersModuleAssemblies =
    [
        OrdersDomainAssembly,
        OrdersApplicationAssembly,
        OrdersInfrastructureAssembly,
        OrdersPresentationAssembly,
        OrdersPublicApiAssembly,
        OrdersIntegrationEventsAssembly
    ];
}
