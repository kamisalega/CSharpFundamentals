using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalegaTech.Domain.Entities;

namespace SalegaTech.Infrastructure.Partners;

public sealed class PartnerConfiguration : IEntityTypeConfiguration<Partner>
{
    public void Configure(EntityTypeBuilder<Partner> b)
    {
        b.ToTable("Partners");
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(10).IsRequired();
        b.Property(x => x.Label).HasMaxLength(100).IsRequired();
        b.HasIndex(x => x.Code).IsUnique();
    }
}