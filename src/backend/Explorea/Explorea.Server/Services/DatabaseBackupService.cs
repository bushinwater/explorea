using System.Diagnostics;
using Npgsql;

namespace Explorea.Server.Services
{
    public class DatabaseBackupService : BackgroundService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<DatabaseBackupService> _logger;

        public DatabaseBackupService(
            IConfiguration configuration,
            IWebHostEnvironment environment,
            ILogger<DatabaseBackupService> logger)
        {
            _configuration = configuration;
            _environment = environment;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var settings = GetSettings();
            if (!settings.Enabled)
            {
                _logger.LogInformation("Database backup service is disabled.");
                return;
            }

            await DeleteExpiredBackupsAsync(settings, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                var delay = GetDelayUntilNextRun(settings.RunAt);
                _logger.LogInformation("Next database backup scheduled in {Delay}.", delay);

                await Task.Delay(delay, stoppingToken);

                try
                {
                    await RunBackupAsync(settings, stoppingToken);
                    await DeleteExpiredBackupsAsync(settings, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Database backup failed.");
                }
            }
        }

        private async Task RunBackupAsync(DatabaseBackupSettings settings, CancellationToken cancellationToken)
        {
            Directory.CreateDirectory(settings.OutputDirectory);

            var connectionString = _configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new InvalidOperationException("DefaultConnection is not configured.");

            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            var backupPath = Path.Combine(
                settings.OutputDirectory,
                $"explorea_{DateTimeOffset.UtcNow:yyyyMMdd_HHmmss}.backup");

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = settings.PgDumpPath,
                    Arguments = BuildPgDumpArguments(builder, backupPath),
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            if (!string.IsNullOrWhiteSpace(builder.Password))
                process.StartInfo.Environment["PGPASSWORD"] = builder.Password;

            _logger.LogInformation("Starting database backup to {BackupPath}.", backupPath);

            process.Start();

            var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);

            await process.WaitForExitAsync(cancellationToken);

            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            if (process.ExitCode != 0)
            {
                if (File.Exists(backupPath))
                    File.Delete(backupPath);

                throw new InvalidOperationException(
                    $"pg_dump exited with code {process.ExitCode}. {stderr}".Trim());
            }

            if (!string.IsNullOrWhiteSpace(stdout))
                _logger.LogInformation("pg_dump output: {Output}", stdout);

            if (!string.IsNullOrWhiteSpace(stderr))
                _logger.LogInformation("pg_dump diagnostics: {Diagnostics}", stderr);

            _logger.LogInformation("Database backup completed: {BackupPath}.", backupPath);
        }

        private async Task DeleteExpiredBackupsAsync(DatabaseBackupSettings settings, CancellationToken cancellationToken)
        {
            Directory.CreateDirectory(settings.OutputDirectory);

            var cutoff = DateTimeOffset.UtcNow.AddDays(-settings.RetentionDays);
            var files = Directory
                .EnumerateFiles(settings.OutputDirectory, "explorea_*.backup")
                .Select(path => new FileInfo(path))
                .Where(file => file.LastWriteTimeUtc < cutoff.UtcDateTime)
                .ToList();

            foreach (var file in files)
            {
                cancellationToken.ThrowIfCancellationRequested();
                file.Delete();
                _logger.LogInformation("Deleted expired database backup: {BackupPath}.", file.FullName);
            }

            await Task.CompletedTask;
        }

        private DatabaseBackupSettings GetSettings()
        {
            var section = _configuration.GetSection("DatabaseBackup");
            var outputDirectory = section["OutputDirectory"];
            if (string.IsNullOrWhiteSpace(outputDirectory))
                outputDirectory = Path.Combine(_environment.ContentRootPath, "DatabaseBackups");
            else if (!Path.IsPathRooted(outputDirectory))
                outputDirectory = Path.Combine(_environment.ContentRootPath, outputDirectory);

            var runAtRaw = section["RunAt"];
            var runAt = TimeSpan.TryParse(runAtRaw, out var parsedRunAt)
                ? parsedRunAt
                : TimeSpan.FromHours(9);

            var retentionDays = section.GetValue<int?>("RetentionDays") ?? 90;
            if (retentionDays < 1)
                retentionDays = 90;

            return new DatabaseBackupSettings
            {
                Enabled = section.GetValue("Enabled", true),
                PgDumpPath = section["PgDumpPath"] ?? "pg_dump",
                OutputDirectory = outputDirectory,
                RunAt = runAt,
                RetentionDays = retentionDays
            };
        }

        private static TimeSpan GetDelayUntilNextRun(TimeSpan runAt)
        {
            var now = DateTimeOffset.Now;
            var nextRun = now.Date + runAt;

            if (nextRun <= now)
                nextRun = nextRun.AddDays(1);

            return nextRun - now;
        }

        private static string BuildPgDumpArguments(NpgsqlConnectionStringBuilder builder, string backupPath)
        {
            var connectionInfo = new List<string>
            {
                $"host={builder.Host}",
                $"port={builder.Port}",
                $"dbname={builder.Database}",
                $"user={builder.Username}"
            };

            if (builder.SslMode != SslMode.Disable)
                connectionInfo.Add($"sslmode={builder.SslMode.ToString().ToLowerInvariant()}");

            return string.Join(" ", new[]
            {
                "--format=custom",
                "--blobs",
                "--no-owner",
                "--no-privileges",
                $"--file \"{backupPath}\"",
                $"--dbname \"{string.Join(" ", connectionInfo)}\""
            });
        }

        private sealed class DatabaseBackupSettings
        {
            public bool Enabled { get; init; }
            public string PgDumpPath { get; init; } = "pg_dump";
            public string OutputDirectory { get; init; } = string.Empty;
            public TimeSpan RunAt { get; init; }
            public int RetentionDays { get; init; }
        }
    }
}
