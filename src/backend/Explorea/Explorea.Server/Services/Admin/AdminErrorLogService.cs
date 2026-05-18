using Explorea.API.DTOs.Admin.Stats;
using Explorea.Server.Services.Admin.Interfaces;

namespace Explorea.Server.Services.Admin
{
    public class AdminErrorLogService : IAdminErrorLogService
    {
        private readonly object _lock = new();
        private AdminLastServerErrorDto? _lastError;

        public void Record(HttpContext context, Exception exception)
        {
            var error = new AdminLastServerErrorDto
            {
                Message = exception.Message,
                ExceptionType = exception.GetType().FullName ?? exception.GetType().Name,
                Path = context.Request.Path.Value ?? string.Empty,
                Method = context.Request.Method,
                OccurredAt = DateTimeOffset.UtcNow
            };

            lock (_lock)
            {
                _lastError = error;
            }
        }

        public AdminLastServerErrorDto? GetLastError()
        {
            lock (_lock)
            {
                return _lastError == null
                    ? null
                    : new AdminLastServerErrorDto
                    {
                        Message = _lastError.Message,
                        ExceptionType = _lastError.ExceptionType,
                        Path = _lastError.Path,
                        Method = _lastError.Method,
                        OccurredAt = _lastError.OccurredAt
                    };
            }
        }
    }
}
