using Evently.Modules.Ticketing.Application.Abstractions.Data;
using Evently.Modules.Ticketing.Domain.Customers;
using Evently.Modules.Ticketing.Infrastructure.Customers;
using Microsoft.EntityFrameworkCore;

namespace Evently.Modules.Ticketing.Infrastructure.Database;

public sealed class TicketingDBContext(DbContextOptions<TicketingDBContext> options) 
    : DbContext(options), IUnitOfWork
{
    internal DbSet<Customer> Customers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {

        modelBuilder.HasDefaultSchema(Schemas.Ticketing);

        modelBuilder.ApplyConfiguration(new CustomerConfiguration());
    }
}
