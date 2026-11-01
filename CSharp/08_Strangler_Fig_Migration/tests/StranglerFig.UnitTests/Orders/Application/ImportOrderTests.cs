using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using StranglerFig.Common.Application;
using StranglerFig.Common.Domain;
using StranglerFig.Modules.Orders.Application.Abstractions.Data;
using StranglerFig.Modules.Orders.Application.Orders.ImportOrder;
using StranglerFig.Modules.Orders.Domain.Orders;

namespace StranglerFig.UnitTests.Orders.Application;

// The command goes through MediatR exactly as in the app (validation pipeline included).
// Only the persistence ports are faked.
public sealed class ImportOrderTests
{
    private static readonly Guid OrderId = Guid.NewGuid();
    private static readonly DateTime CreatedAtUtc = new(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc);

    private readonly FakeOrderRepository _orders = new();
    private readonly FakeUnitOfWork _unitOfWork = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task NewOrder_IsInsertedAndSaved_AsCreated()
    {
        Result<ImportOrderOutcome> result = await SendAsync(Command());

        result.Value.ShouldBe(ImportOrderOutcome.Created);
        _orders.Inserted.ShouldHaveSingleItem().Id.ShouldBe(OrderId);
        _unitOfWork.SaveCount.ShouldBe(1);
    }

    [Fact]
    public async Task ExistingOrder_IsNotInsertedAgain_AsUpdated()
    {
        _orders.Seed(Order.Import(OrderId, "jan@test.local", 149.99m, CreatedAtUtc));

        Result<ImportOrderOutcome> result = await SendAsync(Command());

        result.Value.ShouldBe(ImportOrderOutcome.Updated);
        _orders.Inserted.ShouldBeEmpty();
        _unitOfWork.SaveCount.ShouldBe(1);
    }

    [Fact]
    public async Task OrderShippedInLegacy_IsMarkedAsShipped()
    {
        var existing = Order.Import(OrderId, "jan@test.local", 149.99m, CreatedAtUtc);
        _orders.Seed(existing);

        await SendAsync(Command(isShipped: true));

        existing.Status.ShouldBe(OrderStatus.Shipped);
    }

    [Theory]
    [InlineData("", 149.99)]
    [InlineData("not-an-email", 149.99)]
    [InlineData("jan@test.local", -1)]
    public async Task InvalidCommand_ReturnsAValidationError_AndSavesNothing(string customerEmail, decimal total)
    {
        Result<ImportOrderOutcome> result = await SendAsync(Command(customerEmail, total));

        result.Error.ShouldBeOfType<ValidationError>();
        _orders.Inserted.ShouldBeEmpty();
        _unitOfWork.SaveCount.ShouldBe(0);
    }

    private static ImportOrderCommand Command(
        string customerEmail = "jan@test.local",
        decimal total = 149.99m,
        bool isShipped = false) =>
        new(OrderId, customerEmail, total, isShipped, CreatedAtUtc);

    private async Task<Result<ImportOrderOutcome>> SendAsync(ImportOrderCommand command)
    {
        await using ServiceProvider services = new ServiceCollection()
            .AddLogging()
            .AddApplication([Modules.Orders.Application.AssemblyReference.Assembly])
            .AddSingleton<IOrderRepository>(_orders)
            .AddSingleton<IUnitOfWork>(_unitOfWork)
            .BuildServiceProvider();

        return await services.GetRequiredService<ISender>().Send(command, Ct);
    }

    private sealed class FakeOrderRepository : IOrderRepository
    {
        private readonly Dictionary<Guid, Order> _orders = [];

        public List<Order> Inserted { get; } = [];

        public void Seed(Order order) => _orders[order.Id] = order;

        public Task<Order?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(_orders.GetValueOrDefault(id));

        public void Insert(Order order)
        {
            Inserted.Add(order);
            _orders[order.Id] = order;
        }
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int SaveCount { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCount++;
            return Task.FromResult(1);
        }
    }
}
