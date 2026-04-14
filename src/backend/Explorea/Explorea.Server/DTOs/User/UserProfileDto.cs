namespace Explorea.API.DTOs.User
{
    public class UserProfileDto
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string TravelerRank { get; set; } = null!;
        public int TotalVisits { get; set; }
        public DateTimeOffset MemberSince { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string? Gender { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public UserPreferencesDto? Preferences { get; set; }
        public double? CurrentLatitude { get; set; }
        public double? CurrentLongitude { get; set; }
        public int? CurrentCityId { get; set; }
        public bool Newsletter { get; set; }
    }
}