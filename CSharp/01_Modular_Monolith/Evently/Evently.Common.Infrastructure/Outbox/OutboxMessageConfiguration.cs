using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Evently.Common.Infrastructure.Outbox;

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<InboxMessage>
{
    public void Configure(EntityTypeBuilder<InboxMessage> builder)
    {
        builder.ToTable("outbox_messages");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Content).HasMaxLength(2000)
            .HasColumnType("jsonb");
    }
}
