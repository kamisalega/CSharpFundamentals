using CoreWCF;
using CoreWCF.Channels;
using CoreWCF.Configuration;
using CoreWCF.Description;
using JasperFx.Resources;
using Microsoft.EntityFrameworkCore;
using SalegaTech.Legacy.Persistance;
using SalegaTech.Legacy.Repositories;
using SalegaTech.Legacy.Services;
using SalegaTech.Legacy.SoapContracts;
using Wolverine;
using Wolverine.Redis;

var builder = WebApplication.CreateBuilder(args);



var legacyConn = builder.Configuration.GetConnectionString("LegacyDb")
                 ?? throw new InvalidOperationException("Missing ConnectionStrings:LegacyDb");
builder.Services.AddDbContext<LegacyDbContext>(opt => opt.UseSqlite(legacyConn));


builder.Services.AddScoped<ILegacySimulationRepository, LegacySimulationRepository>();

builder.Services.AddScoped<LegacySoapSimulationService>();

builder.Services.AddScoped<LegacySimulationSoapService>();

builder.Services.AddResourceSetupOnStartup();

var redisConn = builder.Configuration.GetConnectionString("Redis")
                ?? throw new InvalidOperationException("Missing ConnectionStrings:Redis");

builder.Host.UseWolverine(opts =>
{
    opts.UseRedisTransport(redisConn).AutoProvision();


    opts.PublishMessage<SalegaTech.Legacy.Events.LegacySimulationRecordedEvent>()
        .ToRedisStream("legacy-events");

    opts.Discovery.IncludeAssembly(typeof(SalegaTech.ACL.Handlers.ModernSimulationCreatedHandler).Assembly);
    opts.ListenToRedisStream("modern-events", "legacy-host-group");

    opts.Discovery.IncludeAssembly(typeof(Program).Assembly);
});


builder.Services.AddServiceModelServices();
builder.Services.AddServiceModelMetadata();

var app = builder.Build();

app.UseServiceModel(sb =>
{
    sb.AddService<LegacySimulationSoapService>(opt =>
    {
        opt.DebugBehavior.IncludeExceptionDetailInFaults = true;
    });
    sb.AddServiceEndpoint<LegacySimulationSoapService, ILegacySimulationSoapService>(
        new BasicHttpBinding(BasicHttpSecurityMode.None),
        "/soap/legacy");

    var metadata = app.Services.GetRequiredService<ServiceMetadataBehavior>();
    metadata.HttpGetEnabled = true;
});

app.MapGet("/", () => "SalegaTech Legacy Host — SOAP at /soap/legacy, WSDL at /soap/legacy?wsdl");

if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<LegacyDbContext>();
        //db.Database.ExecuteSqlRaw("PRAGMA journal_mode = DELETE;");
        db.Database.Migrate();
    }
}

app.Run();
