using System;

namespace OrdersLegacy
{
    public static class Program
    {
        public static void Main(string[] args)
        {
            string connectionString = Environment.GetEnvironmentVariable("LEGACY_DB");
            string port = Environment.GetEnvironmentVariable("LEGACY_PORT");
            if (port == null)
            {
                port = "8080";
            }

            OrderRepository repository = new OrderRepository(connectionString);
            repository.EnsureSchema();

            Console.WriteLine(
                "OrdersLegacy listening on port {0}, compiled for CLR {1}, running on CLR {2}",
                port,
                typeof(Program).Assembly.ImageRuntimeVersion,
                Environment.Version);

            new OrdersHttpServer("http://*:" + port + "/", repository).Run();
        }
    }
}
