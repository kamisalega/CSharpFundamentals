using StranglerFig.Common.Application;
using StranglerFig.Common.Infrastructure;
using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration;
using StranglerFig.Modules.Orders.Infrastructure;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

string databaseConnectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("Missing connection string 'Database'.");

builder.Services.AddApplication([StranglerFig.Modules.Orders.Application.AssemblyReference.Assembly]);

builder.Services.AddInfrastructure([OrdersModule.ConfigureConsumers], databaseConnectionString);

builder.Services.AddOrdersModule(builder.Configuration);

// Temporary: the strangler fig. Removing this line (and the project) is the cutover.
builder.Services.AddOrdersMigration(builder.Configuration);

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Only the module's schema. public.orders belongs to the legacy app, which creates it itself.
    await app.Services.EnsureOrdersSchemaAsync();
}

app.MapEndpoints();

await app.RunAsync();
