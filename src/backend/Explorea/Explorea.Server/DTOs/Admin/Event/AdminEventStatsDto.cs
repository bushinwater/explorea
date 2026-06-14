namespace Explorea.API.DTOs.Admin.Event
{
  public class AdminEventStatsDto
  {
    public int ActiveRequests { get; set; }
    public string ActiveRequestsTrend { get; set; } = string.Empty;

    public int PendingApproval { get; set; }
    public string PendingApprovalHint { get; set; } = string.Empty;

    public int ApprovedThisMonth { get; set; }
    public string ApprovedThisMonthTrend { get; set; } = string.Empty;

    public int Rejected { get; set; }
    public string RejectedNote { get; set; } = string.Empty;

    public int TabPendingCount { get; set; }
    public int TabActiveCount { get; set; }
    public int TabExpiredCount { get; set; }
    public int TabDeletedCount { get; set; }
  }
}
