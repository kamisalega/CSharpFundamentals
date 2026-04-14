using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using SalegaTech.Domain.Entities;

namespace SalegaTech.Infrastructure.Database;

public class ModernDbContext : DbContext
{
    public ModernDbContext(DbContextOptions<ModernDbContext> options) : base(options) { }

    public DbSet<FinancingSimulation> Simulations => Set<FinancingSimulation>();
    public DbSet<CreditFile> CreditFiles => Set<CreditFile>();
    public DbSet<Partner> Partners => Set<Partner>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ModernDbContext).Assembly);
    }
}

public sealed class ModernDbContextFactory : IDesignTimeDbContextFactory<ModernDbContext>
{
    public ModernDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ModernDbContext>()
            .UseSqlite("Data Source=modern.db")
            .Options;
        return new ModernDbContext(options);
    }
}