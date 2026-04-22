using System.Net;
using System.Text.Json;

namespace Explorea.Server.Middleware
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionMiddleware> _logger;

        public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
        {
            _next   = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
                context.Response.StatusCode  = (int)HttpStatusCode.InternalServerError;
                context.Response.ContentType = "application/json";
                var body = JsonSerializer.Serialize(new { message = "An unexpected error occurred." });
                await context.Response.WriteAsync(body);
            }
        }
    }
}
