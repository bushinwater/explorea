namespace Explorea.API.DTOs.Admin.User
{
    public class AdminUserDetailsDto
    {
        public Guid Id { get; set; }
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Role { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string TravelerRank { get; set; } = null!;
        public string? AvatarUrl { get; set; }
        public string? Bio { get; set; }

        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public int? Age { get; set; }

        public DateTimeOffset MemberSince { get; set; }
        public DateTimeOffset? LastLoginAt { get; set; }
        public DateTimeOffset? EmailVerifiedAt { get; set; }
        public int PlannerItemsTotal { get; set; }

        public AdminUserLocationDto? Location { get; set; }
        public string? ManagedRegion { get; set; }

        public List<AdminUserInterestDto> SelectedInterests { get; set; } = new();
        public List<AdminUserInterestDto> TopInterests { get; set; } = new();
        public List<AdminUserActivityDto> RecentClicks { get; set; } = new();
        public List<AdminUserSavedItemDto> SavedItems { get; set; } = new();
        public int SavedItemsTotal { get; set; }
        public List<AdminUserReviewDto> Reviews { get; set; } = new();
        public int ReviewsTotal { get; set; }

        // Tourist organization (TO) specific
        public List<AdminUserAdminActionDto> RecentAdminActions { get; set; } = new();

        // Place owner specific
        public List<AdminUserOwnedEntityDto> OwnedPlaces { get; set; } = new();
        public int OwnedPlacesTotal { get; set; }
        public List<AdminUserOwnedEntityDto> OwnedEvents { get; set; } = new();
        public int OwnedEventsTotal { get; set; }
    }

    public class AdminUserAdminActionDto
    {
        public string Type { get; set; } = null!;
        public string Description { get; set; } = null!;
        public DateTimeOffset At { get; set; }
    }

    public class AdminUserOwnedEntityDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Slug { get; set; }
        public string? PreviewImageUrl { get; set; }
        public string? Status { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class AdminUserLocationDto
    {
        public string? CityName { get; set; }
        public string? RegionName { get; set; }
        public string? CountryName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }

    public class AdminUserInterestDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string? Icon { get; set; }
        public int? Score { get; set; }
    }

    public class AdminUserActivityDto
    {
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public string? EntityName { get; set; }
        public string? EntitySlug { get; set; }
        public DateTimeOffset At { get; set; }
    }

    public class AdminUserSavedItemDto
    {
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public string? EntityName { get; set; }
        public string? EntitySlug { get; set; }
        public string? PreviewImageUrl { get; set; }
        public DateTimeOffset SavedAt { get; set; }
    }

    public class AdminUserReviewDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = null!;
        public Guid EntityId { get; set; }
        public string? EntityName { get; set; }
        public string? EntitySlug { get; set; }
        public short Rating { get; set; }
        public string? Comment { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}
