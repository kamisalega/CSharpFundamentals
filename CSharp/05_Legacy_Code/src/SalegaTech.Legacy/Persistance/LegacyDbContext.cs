using Microsoft.EntityFrameworkCore;

namespace SalegaTech.Legacy.Persistance;

public sealed class LegacyDbContext : DbContext
{
    public LegacyDbContext(DbContextOptions<LegacyDbContext> options) : base(options) { }

    public DbSet<LegacySimulationRow> Simulations => Set<LegacySimulationRow>();
    public DbSet<LegacyPartnerRow> Partners => Set<LegacyPartnerRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LegacySimulationRow>(b =>
        {
            b.ToTable("TBL_SIMULATION");
            b.HasKey(x => x.Id);
            b.Property(x => x.CDE_DOSSIER).HasMaxLength(20).IsRequired();
            b.Property(x => x.CDE_PARTENAIRE).HasMaxLength(10).IsRequired();
            b.Property(x => x.DT_SIMULATION).HasMaxLength(8).IsRequired();
            b.Property(x => x.MSG_ERREUR).HasMaxLength(200);
            b.HasIndex(x => x.CDE_DOSSIER).IsUnique();
        });

        modelBuilder.Entity<LegacyPartnerRow>(b =>
        {
            b.ToTable("TBL_PARTENAIRE");
            b.HasKey(x => x.Id);
            b.Property(x => x.CDE_PARTENAIRE).HasMaxLength(10).IsRequired();
            b.Property(x => x.LIB_PARTENAIRE).HasMaxLength(100).IsRequired();
            b.HasIndex(x => x.CDE_PARTENAIRE).IsUnique();
        });
    }
}