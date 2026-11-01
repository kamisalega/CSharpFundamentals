using Microsoft.Extensions.Logging;
using StranglerFig.IntegrationTests.Infrastructure;
using StranglerFig.Migration;
using StranglerFig.Migration.Seam;
using Shouldly;

namespace StranglerFig.IntegrationTests;

// Step 4: ParallelVerificationService calls both implementations, logs differences
// and ALWAYS returns the legacy result - users never see the new module's mistakes.
public sealed class ParallelRunTests(LegacyEnvironment legacy)
    : IntegrationTest(legacy, MigrationPhase.ParallelRun, SyncStrategy.None)
{
    [Fact]
    public async Task OrderMissingInNewModule_ReturnsLegacy_AndLogsMismatch()
    {
        OrderDto placed = await Api.PlaceOrderAsync(Ct);

        OrderDto order = await Api.GetOrderOrThrowAsync(placed.Id, Ct);

        order.ShouldBe(placed);
        MismatchesFor(placed.Id).Count.ShouldBe(1);
    }

    private List<string> MismatchesFor(Guid orderId) =>
        App.Logs.GetSnapshot()
            .Where(r => r.Level == LogLevel.Warning && r.Message.Contains($"Order {orderId} mismatch"))
            .Select(r => r.Message)
            .ToList();
}
