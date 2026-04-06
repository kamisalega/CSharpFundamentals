using TravelScribe.API.Endpoints;
using TravelScribe.API.Extensions;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

var ollamaBaseUrl = new Uri(
    builder.Configuration["OLLAMA_BASE_URL"] ?? "http://192.168.1.15:11434");

builder.Services.AddTravelScribeServices(ollamaBaseUrl);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.CustomSchemaIds(t => t.FullName?.Replace("+", "."));
});

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
}
app.UseHttpsRedirection();
app.MapPropertyEndpoints();
app.MapDescriptionEndpoints();



await app.RunAsync();

#pragma warning disable CA1515
public partial class Program
{
}
#pragma warning restore CA1515
