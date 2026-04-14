using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SalegaTech.Application.Abstractions;
using SalegaTech.Infrastructure.Store;
using StackExchange.Redis;

namespace SalegaTech.Api.Tests.Abstractions
{
    public class TestWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override IHost CreateHost(IHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                var toRemove = services.Where(d =>
                    d.ServiceType == typeof(ISimulationResultStore) ||
                    d.ServiceType == typeof(IConnectionMultiplexer)).ToList();

                foreach (var descriptor in toRemove)
                    services.Remove(descriptor);

                services.AddSingleton<ISimulationResultStore, InMemorySimulationResultStore>();
            });

            return base.CreateHost(builder);
        }
    }
}
