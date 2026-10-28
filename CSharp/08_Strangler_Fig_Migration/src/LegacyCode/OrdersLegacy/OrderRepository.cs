using System;
using System.Data.Odbc;
using System.Threading;

namespace OrdersLegacy
{
    // Raw ADO.NET over ODBC - System.Data.Odbc has been in the framework since .NET 1.1.
    // ODBC parameters are positional ("?"), so the order of Parameters.Add calls matters.
    public class OrderRepository
    {
        private readonly string _connectionString;

        public OrderRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public void EnsureSchema()
        {
            // The database container may still be starting - legacy code retried by hand.
            for (int attempt = 1; ; attempt++)
            {
                try
                {
                    Execute(
                        "CREATE TABLE IF NOT EXISTS public.orders (" +
                        "  order_id uuid PRIMARY KEY," +
                        "  customer_email varchar(256) NOT NULL," +
                        "  total numeric(18,2) NOT NULL," +
                        "  status integer NOT NULL," +
                        "  created_at timestamp NOT NULL," +
                        "  modified_at timestamp NOT NULL)");
                    Execute("CREATE INDEX IF NOT EXISTS ix_orders_modified_at ON public.orders (modified_at)");
                    return;
                }
                catch (Exception exception)
                {
                    if (attempt == 30)
                    {
                        throw;
                    }

                    Console.WriteLine("Database not ready ({0}), retrying...", exception.Message);
                    Thread.Sleep(1000);
                }
            }
        }

        public LegacyOrder GetById(Guid id)
        {
            using (OdbcConnection connection = Open())
            using (OdbcCommand command = new OdbcCommand(
                "SELECT order_id::text, customer_email, total, status, created_at, modified_at " +
                "FROM public.orders WHERE order_id = ?::uuid", connection))
            {
                command.Parameters.Add("id", OdbcType.VarChar).Value = id.ToString();

                using (OdbcDataReader reader = command.ExecuteReader())
                {
                    if (!reader.Read())
                    {
                        return null;
                    }

                    LegacyOrder order = new LegacyOrder();
                    order.Id = new Guid(reader.GetString(0));
                    order.CustomerEmail = reader.GetString(1);
                    order.Total = reader.GetDecimal(2);
                    order.Status = reader.GetInt32(3);
                    order.CreatedAt = reader.GetDateTime(4);
                    order.ModifiedAt = reader.GetDateTime(5);
                    return order;
                }
            }
        }

        // Timestamps come from the database clock, not from this process: the sync job in the new
        // system compares them with ITS watermark, and two machines' clocks are never identical.
        public Guid Insert(string customerEmail, decimal total)
        {
            Guid id = Guid.NewGuid();

            using (OdbcConnection connection = Open())
            using (OdbcCommand command = new OdbcCommand(
                "INSERT INTO public.orders (order_id, customer_email, total, status, created_at, modified_at) " +
                "VALUES (?::uuid, ?, ?, ?, now() at time zone 'utc', now() at time zone 'utc')", connection))
            {
                command.Parameters.Add("id", OdbcType.VarChar).Value = id.ToString();
                command.Parameters.Add("email", OdbcType.VarChar).Value = customerEmail;
                command.Parameters.Add("total", OdbcType.Decimal).Value = total;
                command.Parameters.Add("status", OdbcType.Int).Value = LegacyOrderStatus.New;
                command.ExecuteNonQuery();
            }

            return id;
        }

        public bool MarkAsShipped(Guid id)
        {
            using (OdbcConnection connection = Open())
            using (OdbcCommand command = new OdbcCommand(
                "UPDATE public.orders SET status = ?, modified_at = now() at time zone 'utc' " +
                "WHERE order_id = ?::uuid", connection))
            {
                command.Parameters.Add("status", OdbcType.Int).Value = LegacyOrderStatus.Shipped;
                command.Parameters.Add("id", OdbcType.VarChar).Value = id.ToString();
                return command.ExecuteNonQuery() == 1;
            }
        }

        private void Execute(string sql)
        {
            using (OdbcConnection connection = Open())
            using (OdbcCommand command = new OdbcCommand(sql, connection))
            {
                command.ExecuteNonQuery();
            }
        }

        private OdbcConnection Open()
        {
            OdbcConnection connection = new OdbcConnection(_connectionString);
            connection.Open();
            return connection;
        }
    }
}
