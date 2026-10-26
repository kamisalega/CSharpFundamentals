using System.Data.Common;
using Npgsql;
using StranglerFig.Common.Application.Data;

namespace StranglerFig.Common.Infrastructure.Data;

internal sealed class DbConnectionFactory(NpgsqlDataSource dataSource) : IDbConnectionFactory
{
    public async ValueTask<DbConnection> OpenConnectionAsync() => await dataSource.OpenConnectionAsync();
}
