namespace Explorea.API.DTOs.Admin.User
{
    public class AdminUserDirectoryStatsDto
    {
        public int TotalUsers { get; set; }
        public int MaleUsers { get; set; }
        public int FemaleUsers { get; set; }
        public int Under20Users { get; set; }
        public int Over20Users { get; set; }
        public int FlaggedAccounts { get; set; }
    }
}
