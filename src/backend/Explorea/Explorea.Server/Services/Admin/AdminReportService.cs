using System.Text;
using Explorea.API.DTOs.Admin.Report;
using Explorea.API.Models;
using Explorea.Server.Helpers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Admin.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Explorea.Server.Services.Admin
{
    public class AdminReportService : IAdminReportService
    {
        private readonly IAdminReportRepository _repo;
        private readonly IUserRepository _userRepo;
        private readonly IOrganizationAssignmentRepository _assignmentRepo;

        public AdminReportService(
            IAdminReportRepository repo,
            IUserRepository userRepo,
            IOrganizationAssignmentRepository assignmentRepo)
        {
            _repo = repo;
            _userRepo = userRepo;
            _assignmentRepo = assignmentRepo;
        }

        public async Task<ReportInsightsDto> GetInsightsAsync(Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);

            var topRegion     = await _repo.GetTopRegionAsync(destIds, placeOwnerUserId);
            var newUsers      = await _repo.GetNewUsersThisMonthAsync();
            var topEntityType = await _repo.GetTopEntityTypeAsync();
            var countryName   = await _repo.GetCountryNameAsync();
            var currentUser   = await _userRepo.GetByIdWithRoleAsync(currentUserId);
            var scopeRegion   = currentUser?.Role.Name == RoleNames.TouristOrganization
                ? currentUser.ManagedRegion?.Name
                : null;

            return new ReportInsightsDto
            {
                TopRegion         = topRegion,
                NewUsersThisMonth = newUsers,
                TopEntityType     = topEntityType,
                CountryName       = countryName,
                ScopeRegion       = scopeRegion,
            };
        }

        public async Task<List<DestinationsTableItemDto>> GetDestinationsTableAsync(
            string? sortBy, string? filterSubType, string? filterRegion, decimal? filterMinRating,
            Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            return await _repo.GetDestinationsTableAsync(sortBy, filterSubType, filterRegion, filterMinRating, destIds, placeOwnerUserId);
        }

        public async Task<List<EntityTableRowDto>> GetEntityTableAsync(
            string entity, string? sortBy,
            string? filterSubType, string? filterRegion, decimal? filterMinRating,
            string? filterDifficulty, decimal? filterMinPrice, decimal? filterMaxPrice,
            List<string>? filterExtraFilters,
            Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            return await _repo.GetEntityTableAsync(entity, sortBy, filterSubType, filterRegion, filterMinRating, filterDifficulty, filterMinPrice, filterMaxPrice, filterExtraFilters, destIds, placeOwnerUserId);
        }

        public async Task<List<SubtypeOptionDto>> GetSubtypeOptionsAsync(string entity, Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            return await _repo.GetSubtypeOptionsAsync(entity, destIds, placeOwnerUserId);
        }

        public async Task<List<string>> GetFilterOptionsAsync(string entity, string field, Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            return await _repo.GetFilterOptionsAsync(entity, field, destIds, placeOwnerUserId);
        }

        public async Task<List<AggregatePointDto>> GetAggregateAsync(
            string entity, string groupBy, string metric,
            DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId, Guid? specificEntityId = null)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            return await _repo.GetAggregateAsync(entity, groupBy, metric, dateFrom, dateTo, destIds, placeOwnerUserId, specificEntityId);
        }

        public async Task<List<EntitySearchItemDto>> SearchEntitiesAsync(string entity, string q, Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            return await _repo.SearchEntitiesAsync(entity, q, destIds, placeOwnerUserId);
        }

        public async Task<EntityProfileDto?> GetEntityProfileAsync(string entity, Guid entityId, Guid currentUserId)
        {
            await BuildScopeAsync(currentUserId); // authorization check
            return await _repo.GetEntityProfileAsync(entity, entityId);
        }

        public async Task<List<ReportDataPointDto>> GetPreviewAsync(
            List<string> metrics, List<string> dimensions,
            DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            var from = dateFrom ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var to   = dateTo   ?? DateOnly.FromDateTime(DateTime.UtcNow);
            return await BuildDataPointsAsync(metrics, dimensions, from, to, destIds, placeOwnerUserId);
        }

        public async Task<(byte[] Data, string FileName)> ExportCsvAsync(
            List<string> metrics, List<string> dimensions,
            DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            var from = dateFrom ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var to   = dateTo   ?? DateOnly.FromDateTime(DateTime.UtcNow);

            var dataPoints = await BuildDataPointsAsync(metrics, dimensions, from, to, destIds, placeOwnerUserId);
            var headers    = BuildHeaders(metrics, dimensions);

            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", headers));

            foreach (var pt in dataPoints)
            {
                var row = new List<string> { pt.Date };
                if (metrics.Contains("traffic"))        row.Add((pt.Traffic        ?? 0).ToString());
                if (metrics.Contains("conversionRate")) row.Add((pt.ConversionRate ?? 0).ToString("F2"));
                if (metrics.Contains("userGrowth"))     row.Add((pt.UserGrowth     ?? 0).ToString());
                if (dimensions.Contains("reviews"))     row.Add((pt.Reviews        ?? 0).ToString());
                if (dimensions.Contains("requests"))    row.Add((pt.Requests       ?? 0).ToString());
                sb.AppendLine(string.Join(",", row));
            }

            return (Encoding.UTF8.GetBytes(sb.ToString()), "report.csv");
        }

        public async Task<(byte[] Data, string FileName)> ExportPdfAsync(
            List<string> metrics, List<string> dimensions,
            DateOnly? dateFrom, DateOnly? dateTo, Guid currentUserId)
        {
            var (destIds, placeOwnerUserId) = await BuildScopeAsync(currentUserId);
            var from = dateFrom ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var to   = dateTo   ?? DateOnly.FromDateTime(DateTime.UtcNow);

            var dataPoints = await BuildDataPointsAsync(metrics, dimensions, from, to, destIds, placeOwnerUserId);
            var headers    = BuildHeaders(metrics, dimensions);

            QuestPDF.Settings.License = LicenseType.Community;

            var pdf = Document.Create(document =>
            {
                document.Page(page =>
                {
                    page.Size(PageSizes.A4.Landscape());
                    page.Margin(30);

                    page.Header()
                        .PaddingBottom(10)
                        .Text($"Explorea — Report ({from:yyyy-MM-dd} to {to:yyyy-MM-dd})")
                        .FontSize(16).Bold();

                    page.Content().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            foreach (var _ in headers)
                                cols.RelativeColumn();
                        });

                        table.Header(header =>
                        {
                            foreach (var h in headers)
                                header.Cell().Background("#DDDDDD").Padding(4).Text(h).Bold().FontSize(9);
                        });

                        foreach (var pt in dataPoints)
                        {
                            table.Cell().Padding(3).Text(pt.Date).FontSize(8);
                            if (metrics.Contains("traffic"))        table.Cell().Padding(3).Text((pt.Traffic        ?? 0).ToString()).FontSize(8);
                            if (metrics.Contains("conversionRate")) table.Cell().Padding(3).Text($"{pt.ConversionRate ?? 0:F2}%").FontSize(8);
                            if (metrics.Contains("userGrowth"))     table.Cell().Padding(3).Text((pt.UserGrowth     ?? 0).ToString()).FontSize(8);
                            if (dimensions.Contains("reviews"))     table.Cell().Padding(3).Text((pt.Reviews        ?? 0).ToString()).FontSize(8);
                            if (dimensions.Contains("requests"))    table.Cell().Padding(3).Text((pt.Requests       ?? 0).ToString()).FontSize(8);
                        }
                    });

                    page.Footer()
                        .AlignCenter()
                        .Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
                        .FontSize(8);
                });
            }).GeneratePdf();

            return (pdf, "report.pdf");
        }

        public async Task<List<ReportTemplateDto>> GetTemplatesAsync(Guid currentUserId)
        {
            await BuildScopeAsync(currentUserId);
            var templates = await _repo.GetTemplatesAsync(currentUserId);
            return templates.Select(MapToDto).ToList();
        }

        public async Task<ReportTemplateDto> CreateTemplateAsync(CreateReportTemplateDto dto, Guid currentUserId)
        {
            await BuildScopeAsync(currentUserId);
            var template = new ReportTemplate
            {
                Id         = Guid.NewGuid(),
                UserId     = currentUserId,
                Name       = dto.Name,
                Parameters = dto.Parameters,
                CreatedAt  = DateTimeOffset.UtcNow,
                UpdatedAt  = DateTimeOffset.UtcNow
            };
            await _repo.AddTemplateAsync(template);
            await _repo.SaveChangesAsync();
            return MapToDto(template);
        }

        public async Task<bool> DeleteTemplateAsync(Guid id, Guid currentUserId)
        {
            var template = await _repo.GetTemplateByIdAsync(id, currentUserId);
            if (template == null) return false;
            _repo.RemoveTemplate(template);
            await _repo.SaveChangesAsync();
            return true;
        }

        // --- Private helpers ---

        private async Task<(List<Guid>? DestinationIds, Guid? PlaceOwnerUserId)> BuildScopeAsync(Guid userId)
        {
            var user = await _userRepo.GetByIdWithRoleAsync(userId);

            if (user?.Role.Name == RoleNames.SuperAdmin)
                return (null, null);

            if (user?.Role.Name == RoleNames.TouristOrganization)
            {
                if (user.ManagedRegionId.HasValue)
                {
                    var destIds = await _repo.GetDestinationIdsByRegionAsync(user.ManagedRegionId.Value);
                    return (destIds, null);
                }
                // Fallback when no region set: use assignment-based scope
                var assignments = await _assignmentRepo.GetByUserIdAsync(userId);
                return (assignments.Select(a => a.DestinationId).ToList(), null);
            }

            if (user?.Role.Name == RoleNames.PlaceOwner)
                return (null, userId);

            throw new UnauthorizedAccessException("Access denied.");
        }

        private async Task<List<ReportDataPointDto>> BuildDataPointsAsync(
            List<string> metrics, List<string> dimensions,
            DateOnly from, DateOnly to,
            List<Guid>? destIds, Guid? placeOwnerUserId)
        {
            var dates = new List<DateOnly>();
            for (var d = from; d <= to; d = d.AddDays(1))
                dates.Add(d);

            Dictionary<DateOnly, long>? trafficByDate    = null;
            Dictionary<DateOnly, long>? reviewsByDate    = null;
            Dictionary<DateOnly, long>? userGrowthByDate = null;
            Dictionary<DateOnly, long>? requestsByDate   = null;

            bool needTraffic = metrics.Contains("traffic") || metrics.Contains("conversionRate");
            bool needReviews = metrics.Contains("conversionRate") || dimensions.Contains("reviews");

            if (needTraffic)
                trafficByDate = await _repo.GetTrafficByDateAsync(from, to, destIds, placeOwnerUserId);

            if (needReviews)
                reviewsByDate = await _repo.GetReviewsByDateAsync(from, to, destIds, placeOwnerUserId);

            if (metrics.Contains("userGrowth"))
                userGrowthByDate = await _repo.GetUserGrowthByDateAsync(from, to);

            if (dimensions.Contains("requests"))
                requestsByDate = await _repo.GetRequestsByDateAsync(from, to, destIds, placeOwnerUserId);

            return dates.Select(d =>
            {
                var pt = new ReportDataPointDto { Date = d.ToString("yyyy-MM-dd") };

                if (metrics.Contains("traffic"))
                    pt.Traffic = trafficByDate!.TryGetValue(d, out var t) ? t : 0;

                if (metrics.Contains("conversionRate"))
                {
                    var traffic = trafficByDate!.TryGetValue(d, out var tv) ? tv : 0;
                    var reviews = reviewsByDate!.TryGetValue(d, out var rv) ? rv : 0;
                    pt.ConversionRate = traffic > 0 ? Math.Round((double)reviews / traffic * 100, 2) : 0;
                }

                if (metrics.Contains("userGrowth"))
                    pt.UserGrowth = userGrowthByDate!.TryGetValue(d, out var ug) ? ug : 0;

                if (dimensions.Contains("reviews"))
                    pt.Reviews = reviewsByDate!.TryGetValue(d, out var rv2) ? rv2 : 0;

                if (dimensions.Contains("requests"))
                    pt.Requests = requestsByDate!.TryGetValue(d, out var rq) ? rq : 0;

                return pt;
            }).ToList();
        }

        private static List<string> BuildHeaders(List<string> metrics, List<string> dimensions)
        {
            var headers = new List<string> { "Date" };
            if (metrics.Contains("traffic"))        headers.Add("Traffic");
            if (metrics.Contains("conversionRate")) headers.Add("ConversionRate (%)");
            if (metrics.Contains("userGrowth"))     headers.Add("UserGrowth");
            if (dimensions.Contains("reviews"))     headers.Add("Reviews");
            if (dimensions.Contains("requests"))    headers.Add("Requests");
            return headers;
        }

        private static ReportTemplateDto MapToDto(ReportTemplate t) => new()
        {
            Id         = t.Id,
            Name       = t.Name,
            Parameters = t.Parameters,
            CreatedAt  = t.CreatedAt
        };
    }
}
