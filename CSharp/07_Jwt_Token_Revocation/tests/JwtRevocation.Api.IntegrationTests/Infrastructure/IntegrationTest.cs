using JwtRevocation.Api.Database;
using Microsoft.Extensions.DependencyInjection;

namespace JwtRevocation.Api.IntegrationTests.Infrastructure;

public abstract class IntegrationTest(ApiFactory factory)
{
    protected ApiFactory Factory { get; } = factory;

    protected AuthApi Api { get; } = new(factory.CreateClient());

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    protected async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        using var scope = Factory.Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
}
