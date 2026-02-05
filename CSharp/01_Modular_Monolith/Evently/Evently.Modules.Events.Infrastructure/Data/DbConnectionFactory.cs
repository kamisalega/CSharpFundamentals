using System.Data.Common;
using Evently.Common.Application.Data;
using Npgsql;

namespace Evently.Modules.Events.Infrastructure.Data;
internal sealed class DbConnectionFactory(NpgsqlDataSource dataSource) : IDbConnectionFactory
{
    public async ValueTask<DbConnection> OpenConnectionAsync()
    {
        return await dataSource.OpenConnectionAsync();
    }
}
