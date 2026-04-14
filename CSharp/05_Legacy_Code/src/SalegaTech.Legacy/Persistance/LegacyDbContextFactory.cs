using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SalegaTech.Legacy.Persistance;

public sealed class LegacyDbContextFactory : IDesignTimeDbContextFactory<LegacyDbContext>
{
    public LegacyDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<LegacyDbContext>()
            .UseSqlite("Data Source=legacy.db")
            .Options;
        return new LegacyDbContext(options);
    }
}