using Microsoft.EntityFrameworkCore;
using StranglerFig.Modules.Orders.Application.Abstractions.Data;
using StranglerFig.Modules.Orders.Domain.Orders;
using StranglerFig.Modules.Orders.Infrastructure.Orders;

namespace StranglerFig.Modules.Orders.Infrastructure.Database;

// Own schema = own data. Legacy lives in "public" and the module never reads it.
public sealed class OrdersDbContext(DbContextOptions<OrdersDbContext> options) : DbContext(options), IUnitOfWork
{
    internal DbSet<Order> Orders { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schemas.Orders);

        modelBuilder.ApplyConfiguration(new OrderConfiguration());
    }
}
