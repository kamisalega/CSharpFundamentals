using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalegaTech.Domain.Entities;

namespace SalegaTech.Infrastructure.Financings;

public sealed class FinancingSimulationConfiguration : IEntityTypeConfiguration<FinancingSimulation>
{
    public void Configure(EntityTypeBuilder<FinancingSimulation> b)
    {
        b.ToTable("FinancingSimulations");
        b.HasKey(x => x.Id);
        b.Property(x => x.SimulationCode).HasMaxLength(32).IsRequired();
        b.HasIndex(x => x.SimulationCode).IsUnique();
        b.Property(x => x.NumberOfInstallments);
        b.Property(x => x.Type).HasConversion<int>();
        b.Property(x => x.SimulationDate);


        b.OwnsOne(x => x.Amount, o =>
        {
            o.Property(p => p.Value).HasColumnName("Amount_Value").HasPrecision(18, 2);
            o.Property(p => p.Currency).HasColumnName("Amount_Currency").HasMaxLength(3);
        });

        b.OwnsOne(x => x.ResidualValue, o =>
        {
            o.Property(p => p.Value).HasColumnName("ResidualValue_Value").HasPrecision(18, 2);
            o.Property(p => p.Currency).HasColumnName("ResidualValue_Currency").HasMaxLength(3);
        });

        b.OwnsOne(x => x.MonthlyPayment, o =>
        {
            o.Property(p => p.Value).HasColumnName("MonthlyPayment_Value").HasPrecision(18, 2);
            o.Property(p => p.Currency).HasColumnName("MonthlyPayment_Currency").HasMaxLength(3);
        });

        b.OwnsOne(x => x.Rate, o =>
        {
            o.Property(p => p.ValueAsPercentage).HasColumnName("Rate_ValueAsPercentage").HasPrecision(5, 2);
        });

        b.Ignore(x => x.DomainEvents);
    }
}

