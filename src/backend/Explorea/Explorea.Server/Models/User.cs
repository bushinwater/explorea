using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NetTopologySuite.Geometries;

namespace Explorea.API.Models
{
    [Table("users")]
    public class User
    {
        [Key, Column("id")]
        public Guid Id { get; set; }

        [Required, MaxLength(100), Column("first_name")]
        public string FirstName { get; set; } = null!;

        [Required, MaxLength(100), Column("last_name")]
        public string LastName { get; set; } = null!;

        [Required, MaxLength(255), Column("email")]
        public string Email { get; set; } = null!;

        [MaxLength(512), Column("password_hash")]
        public string? PasswordHash { get; set; }

        [Column("role_id")]
        public int RoleId { get; set; }

        [Required, MaxLength(50), Column("traveler_rank")]
        public string TravelerRank { get; set; } = "explorer";

        [Column("total_visits")]
        public int TotalVisits { get; set; } = 0;

        [Column("member_since")]
        public DateTimeOffset MemberSince { get; set; }

        [Column("email_verified_at")]
        public DateTimeOffset? EmailVerifiedAt { get; set; }

        [Column("last_login_at")]
        public DateTimeOffset? LastLoginAt { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("newsletter")]
        public bool Newsletter { get; set; } = false;

        [MaxLength(20), Column("gender")]
        public string? Gender { get; set; }

        [Column("date_of_birth")]
        public DateOnly? DateOfBirth { get; set; }

        [Column("current_latitude")]
        public double? CurrentLatitude { get; set; }

        [Column("current_longitude")]
        public double? CurrentLongitude { get; set; }

        [Column("current_city_id")]
        public int? CurrentCityId { get; set; }

        [Column("managed_region_id")]
        public int? ManagedRegionId { get; set; }

        [Column("current_location", TypeName = "geography(Point, 4326)")]
        public Point? CurrentLocation { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("RoleId")]
        public Role Role { get; set; } = null!;

        [ForeignKey("CurrentCityId")] public City? CurrentCity { get; set; }
        [ForeignKey("ManagedRegionId")] public Region? ManagedRegion { get; set; }

        public UserPreferences?             Preferences  { get; set; }
        public ICollection<UserAuthAccount> AuthAccounts { get; set; } = new List<UserAuthAccount>();
        public ICollection<RefreshToken>    RefreshTokens{ get; set; } = new List<RefreshToken>();
        public ICollection<Review>          Reviews      { get; set; } = new List<Review>();
        public ICollection<SavedItem>       SavedItems   { get; set; } = new List<SavedItem>();
        public ICollection<Visit>           Visits       { get; set; } = new List<Visit>();
        public ICollection<TripPlan>        TripPlans    { get; set; } = new List<TripPlan>();
        public ICollection<UserInterestTag> InterestTags { get; set; } = new List<UserInterestTag>();
        public ICollection<OrganizationRegionAssignment> OrganizationRegionAssignments { get; set; } = new List<OrganizationRegionAssignment>();

        [MaxLength(500), Column("profile_image_url")]
        public string? ProfileImageUrl { get; set; }
    }
}
