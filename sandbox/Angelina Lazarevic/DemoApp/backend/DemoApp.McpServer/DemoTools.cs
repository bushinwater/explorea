using System.ComponentModel;
using System.Net.Http;
using System.Net.Http.Json;
using ModelContextProtocol.Server;

[McpServerToolType]
public static class DemoTools
{
    private static HttpClient CreateClient()
    {
        return new HttpClient
        {
            BaseAddress = new Uri("http://localhost:5041/")
        };
    }

    [McpServerTool, Description("Vraća sve događaje iz sistema.")]
    public static async Task<string> GetEvents()
    {
        try
        {
            using var httpClient = CreateClient();

            var response = await httpClient.GetAsync("api/mcp/events");
            var content = await response.Content.ReadAsStringAsync();

            return $"STATUS: {(int)response.StatusCode}\nBODY: {content}";
        }
        catch (Exception ex)
        {
            return $"EXCEPTION: {ex.Message}\nINNER: {ex.InnerException?.Message}";
        }
    }

    [McpServerTool, Description("Vraća sve prijave na događaje.")]
    public static async Task<string> GetRegistrations()
    {
        try
        {
            using var httpClient = CreateClient();

            var response = await httpClient.GetAsync("api/mcp/registrations");
            var content = await response.Content.ReadAsStringAsync();

            return $"STATUS: {(int)response.StatusCode}\nBODY: {content}";
        }
        catch (Exception ex)
        {
            return $"EXCEPTION: {ex.Message}\nINNER: {ex.InnerException?.Message}";
        }
    }

    [McpServerTool, Description("Kreira novi događaj u sistemu.")]
    public static async Task<string> CreateEvent(
        [Description("Naziv događaja")] string title,
        [Description("Opis događaja")] string description,
        [Description("Lokacija")] string location,
        [Description("Datum u ISO formatu, npr. 2026-03-25T18:00:00")] string date,
        [Description("Kapacitet")] int capacity)
    {
        try
        {
            using var httpClient = CreateClient();

            var payload = new
            {
                title,
                description,
                location,
                date,
                capacity
            };

            var response = await httpClient.PostAsJsonAsync("api/mcp/events", payload);
            var content = await response.Content.ReadAsStringAsync();

            return $"STATUS: {(int)response.StatusCode}\nBODY: {content}";
        }
        catch (Exception ex)
        {
            return $"EXCEPTION: {ex.Message}\nINNER: {ex.InnerException?.Message}";
        }
    }
}