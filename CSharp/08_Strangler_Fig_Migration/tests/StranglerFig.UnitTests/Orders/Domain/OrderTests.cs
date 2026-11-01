using Shouldly;
using StranglerFig.Common.Domain;
using StranglerFig.Modules.Orders.Domain.Orders;

namespace StranglerFig.UnitTests.Orders.Domain;

public sealed class OrderTests
{
    private static readonly Guid LegacyId = Guid.NewGuid();
    private static readonly DateTime CreatedAtUtc = new(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void Import_KeepsTheLegacyIdAndData_AsAPendingOrder()
    {
        var order = Order.Import(LegacyId, "jan@test.local", 149.99m, CreatedAtUtc);

        order.Id.ShouldBe(LegacyId);
        order.CustomerEmail.ShouldBe("jan@test.local");
        order.Total.ShouldBe(149.99m);
        order.Status.ShouldBe(OrderStatus.Pending);
        order.CreatedAtUtc.ShouldBe(CreatedAtUtc);
    }

    [Fact]
    public void Import_RaisesOrderImportedDomainEvent()
    {
        var order = Order.Import(LegacyId, "jan@test.local", 149.99m, CreatedAtUtc);

        order.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<OrderImportedDomainEvent>().OrderId.ShouldBe(LegacyId);
    }

    [Fact]
    public void MarkAsShipped_ChangesTheStatus()
    {
        var order = Order.Import(LegacyId, "jan@test.local", 149.99m, CreatedAtUtc);

        order.MarkAsShipped();

        order.Status.ShouldBe(OrderStatus.Shipped);
    }

    [Fact]
    public void NotFound_IsANotFoundError_NamingTheOrder()
    {
        Error error = OrderErrors.NotFound(LegacyId);

        error.Type.ShouldBe(ErrorType.NotFound);
        error.Code.ShouldBe("Orders.NotFound");
        error.Description.ShouldContain(LegacyId.ToString());
    }
}
