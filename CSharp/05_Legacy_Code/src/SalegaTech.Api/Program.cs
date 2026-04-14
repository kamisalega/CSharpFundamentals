using FluentValidation;
using JasperFx.Resources;
using Microsoft.EntityFrameworkCore;
using SalegaTech.Application.Financings;
using SalegaTech.Infrastructure;
using SalegaTech.Infrastructure.Database;
using Wolverine;
using Wolverine.FluentValidation;
using Wolverine.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


builder.Services.AddResourceSetupOnStartup();
builder.Services.AddInfrastructure(builder.Configuration);

var redisConn = builder.Configuration.GetConnectionString("Redis")
                ?? throw new InvalidOperationException("Missing ConnectionStrings:Redis");

builder.Services.AddValidatorsFromAssembly(
    typeof(SimulateFinancingCommandValidator).Assembly);

builder.Host.UseWolverine(opts =>
{
    opts.UseRedisTransport(redisConn).AutoProvision();

    opts.PublishMessage<SalegaTech.Application.Events.ModernSimulationCreatedEvent>()
        .ToRedisStream("modern-events");

    opts.ListenToRedisStream("legacy-events", "modern-api-group");

    opts.Discovery.IncludeAssembly(typeof(SimulateFinancingHandler).Assembly);
    opts.Discovery.IncludeAssembly(typeof(SalegaTech.ACL.Handlers.LegacySimulationRecordedHandler).Assembly);


    opts.UseFluentValidation();
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ModernDbContext>();
        db.Database.Migrate();
    }
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.Run();


namespace SalegaTech.Api
{
    public partial class Program
    {
    }
}