using ModelContextProtocol.AspNetCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// registrujemo MCP server sa svim toolovima koji su označeni atributima
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithToolsFromAssembly();

// registrujemo konekciju na bazu kroz dependency injection
// connection string čitamo iz appsettings.json kao i u glavnom projektu
builder.Services.AddScoped<NpgsqlConnection>(_ =>
    new NpgsqlConnection(
        builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

app.MapMcp();

app.Run();