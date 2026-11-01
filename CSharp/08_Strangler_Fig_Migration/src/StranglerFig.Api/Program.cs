using StranglerFig.Common.Presentation.Endpoints;
using StranglerFig.Migration;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Temporary: the strangler fig. Removing this line (and the project) is the cutover.
builder.Services.AddOrdersMigration(builder.Configuration);

WebApplication app = builder.Build();

app.MapEndpoints();

await app.RunAsync();
