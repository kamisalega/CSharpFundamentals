using System.Data.Common;
using Dapper;
using StranglerFig.Common.Application.Data;

namespace StranglerFig.Migration.Legacy;

internal sealed record LegacyOrderRow(
    Guid OrderId,
    string CustomerEmail,
    decimal Total,
    int Status,
    DateTime CreatedAt,
    DateTime ModifiedAt);

// Option A reads the legacy table directly, as in the article. The table belongs to the legacy app:
// read-only, and only here - in temporary migration code, never in the Orders module.
internal sealed class LegacyOrdersReader(IDbConnectionFactory dbConnectionFactory)
{
    public async Task<IReadOnlyList<LegacyOrderRow>> GetOrdersChangedSinceAsync(DateTime since)
    {
        await using DbConnection connection = await dbConnectionFactory.OpenConnectionAsync();

        // ">=" instead of ">": a row written in the same microsecond as the watermark must not be lost.
        // Importing a row twice is harmless (ImportOrderCommand is an upsert), missing one is not.
        const string sql =
            $"""
             SELECT
                 order_id AS {nameof(LegacyOrderRow.OrderId)},
                 customer_email AS {nameof(LegacyOrderRow.CustomerEmail)},
                 total AS {nameof(LegacyOrderRow.Total)},
                 status AS {nameof(LegacyOrderRow.Status)},
                 created_at AS {nameof(LegacyOrderRow.CreatedAt)},
                 modified_at AS {nameof(LegacyOrderRow.ModifiedAt)}
             FROM public.orders
             WHERE modified_at >= @Since
             ORDER BY modified_at
             """;

        IEnumerable<LegacyOrderRow> rows = await connection.QueryAsync<LegacyOrderRow>(sql, new { Since = since });

        return rows.ToList();
    }
}
