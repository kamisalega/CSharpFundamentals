using Evently.Api.Extensions;
using Evently.Common.Application;
using Evently.Modules.Events.Infrastructure;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);


builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.CustomSchemaIds(t => t.FullName?.Replace("+", "."));
});
builder.Services.AddEventsModule(builder.Configuration);
builder.Services.AddApplication([Evently.Modules.Events.Application.AssemblyReference.Assembly]);
WebApplication app = builder.Build();


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.ApplyMigrations();
}

app.UseHttpsRedirection();

EventsModule.MapsEndpoints(app);

await app.RunAsync();
