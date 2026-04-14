using Microsoft.EntityFrameworkCore;
using SalegaTech.Domain.Entities;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SalegaTech.Infrastructure.Credits;

public sealed class CreditFileConfiguration : IEntityTypeConfiguration<CreditFile>
{
    public void Configure(EntityTypeBuilder<CreditFile> b)
    {
        b.ToTable("CreditFiles");
        b.HasKey(x => x.Id);
        b.Property(x => x.FileCode).HasMaxLength(32).IsRequired();
        b.HasIndex(x => x.FileCode).IsUnique();
        b.Property(x => x.Status).HasConversion<int>();
        b.Property(x => x.CreatedDate);

        b.HasOne(x => x.Simulation).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Partner).WithMany().OnDelete(DeleteBehavior.Restrict);

        b.Ignore(x => x.DomainEvents);
    }
}