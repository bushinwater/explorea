using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Security.AccessControl;
using Explorea.API.Models;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // DbSets:
        public DbSet<Region> Regions { get; set; }
        public DbSet<City> Cities { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserAuthAccount> UserAuthAccounts { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
        public DbSet<EmailVerification> EmailVerifications { get; set; }
        public DbSet<UserPreferences> UserPreferences { get; set; }
        public DbSet<Destination> Destinations { get; set; }
        public DbSet<DestinationImage> DestinationImages { get; set; }
        public DbSet<PlaceType> PlaceTypes { get; set; }
        public DbSet<Place> Places { get; set; }
        public DbSet<PlaceImage> PlaceImages { get; set; }
        public DbSet<PlaceAmenity> PlaceAmenities { get; set; }
        public DbSet<PlaceAmenityLink> PlaceAmenityLinks { get; set; }
        public DbSet<PlaceWorkingDay> PlaceWorkingDays { get; set; }
        public DbSet<PlaceWorkingHourInterval> PlaceWorkingHourIntervals { get; set; }
        public DbSet<EventType> EventTypes { get; set; }
        public DbSet<Event> Events { get; set; }
        public DbSet<EventImage> EventImages { get; set; }
        public DbSet<ActivityCategory> ActivityCategories { get; set; }
        public DbSet<Season> Seasons { get; set; }
        public DbSet<Activity> Activities { get; set; }
        public DbSet<ActivityInclusion> ActivityInclusions { get; set; }
        public DbSet<ActivityImage> ActivityImages { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<SavedItem> SavedItems { get; set; }
        public DbSet<Visit> Visits { get; set; }
        public DbSet<TripPlan> TripPlans { get; set; }
        public DbSet<TripPlanItem> TripPlanItems { get; set; }
        public DbSet<InterestTag> InterestTags { get; set; }
        public DbSet<UserInterestTag> UserInterestTags { get; set; }
        public DbSet<DestinationInterestTag> DestinationInterestTags { get; set; }
        public DbSet<PlaceInterestTag> PlaceInterestTags { get; set; }
        public DbSet<EventInterestTag> EventInterestTags { get; set; }
        public DbSet<ActivityInterestTag> ActivityInterestTags { get; set; }
        public DbSet<Country> Countries { get; set; }
        public DbSet<OrganizationAssignment> OrganizationAssignments { get; set; }
        public DbSet<OrganizationRegionAssignment> OrganizationRegionAssignments { get; set; }
        public DbSet<SubmissionQueue> SubmissionQueue { get; set; }
        public DbSet<Newsletter> Newsletters { get; set; }
        public DbSet<DestinationType>  DestinationTypes  { get; set; }
        public DbSet<FilterDefinition> FilterDefinitions { get; set; }
        public DbSet<FilterOption>     FilterOptions     { get; set; }
        public DbSet<PopularityLog> PopularityLogs { get; set; }
        public DbSet<UserInterestScore> UserInterestScores { get; set; }
        public DbSet<BugReport> BugReports { get; set; }
        public DbSet<ReportTemplate> ReportTemplates { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Newsletter>(entity =>
            {
                entity.ToTable("newsletter");
                entity.HasKey(x => x.Email);
                entity.Property(x => x.Email)
                      .HasColumnName("email")
                      .HasMaxLength(255)
                      .IsRequired();
            });

            // ---- Composite primary keys ----
            modelBuilder.Entity<UserInterestScore>()
                .HasKey(x => new { x.UserId, x.InterestTagId });

            modelBuilder.Entity<PlaceAmenityLink>()
                .HasKey(x => new { x.PlaceId, x.AmenityId });

            modelBuilder.Entity<UserInterestTag>()
                .HasKey(x => new { x.UserId, x.InterestTagId });

            // ---- PlaceAmenityLink relacije ----
            modelBuilder.Entity<PlaceAmenityLink>()
                .HasOne(x => x.Place)
                .WithMany(p => p.AmenityLinks)
                .HasForeignKey(x => x.PlaceId);

            modelBuilder.Entity<PlaceAmenityLink>()
                .HasOne(x => x.Amenity)
                .WithMany(a => a.PlaceLinks)
                .HasForeignKey(x => x.AmenityId);

            // ---- UserInterestTag relacije ----
            modelBuilder.Entity<UserInterestTag>()
                .HasOne(x => x.User)
                .WithMany(u => u.InterestTags)
                .HasForeignKey(x => x.UserId);

            modelBuilder.Entity<UserInterestTag>()
                .HasOne(x => x.InterestTag)
                .WithMany(t => t.UserLinks)
                .HasForeignKey(x => x.InterestTagId);

            // ---- DestinationInterestTag ----
            modelBuilder.Entity<DestinationInterestTag>()
                .HasKey(x => new { x.DestinationId, x.InterestTagId });
            modelBuilder.Entity<DestinationInterestTag>()
                .HasOne(x => x.Destination).WithMany().HasForeignKey(x => x.DestinationId);
            modelBuilder.Entity<DestinationInterestTag>()
                .HasOne(x => x.InterestTag).WithMany(t => t.DestinationLinks).HasForeignKey(x => x.InterestTagId);

            // ---- PlaceInterestTag ----
            modelBuilder.Entity<PlaceInterestTag>()
                .HasKey(x => new { x.PlaceId, x.InterestTagId });
            modelBuilder.Entity<PlaceInterestTag>()
                .HasOne(x => x.Place).WithMany().HasForeignKey(x => x.PlaceId);
            modelBuilder.Entity<PlaceInterestTag>()
                .HasOne(x => x.InterestTag).WithMany(t => t.PlaceLinks).HasForeignKey(x => x.InterestTagId);

            // ---- EventInterestTag ----
            modelBuilder.Entity<EventInterestTag>()
                .HasKey(x => new { x.EventId, x.InterestTagId });
            modelBuilder.Entity<EventInterestTag>()
                .HasOne(x => x.Event).WithMany(e => e.InterestTags).HasForeignKey(x => x.EventId);  
            modelBuilder.Entity<EventInterestTag>()
                .HasOne(x => x.InterestTag).WithMany(t => t.EventLinks).HasForeignKey(x => x.InterestTagId);

            // ---- ActivityInterestTag ----
            modelBuilder.Entity<ActivityInterestTag>()
                .HasKey(x => new { x.ActivityId, x.InterestTagId });
            modelBuilder.Entity<ActivityInterestTag>()
                .HasOne(x => x.Activity).WithMany(a => a.InterestTags).HasForeignKey(x => x.ActivityId);
            modelBuilder.Entity<ActivityInterestTag>()
                .HasOne(x => x.InterestTag).WithMany(t => t.ActivityLinks).HasForeignKey(x => x.InterestTagId);

            // ---- Activity.ExtraData kao JSONB ----
            modelBuilder.Entity<Activity>()
                .Property(a => a.ExtraData)
                .HasColumnType("jsonb");

            // ---- extra_filters JSONB ----
            modelBuilder.Entity<Place>()
                .Property(p => p.ExtraFilters)
                .HasColumnType("jsonb");

            modelBuilder.Entity<Event>()
                .Property(e => e.ExtraFilters)
                .HasColumnType("jsonb");

            modelBuilder.Entity<Destination>()
                .Property(d => d.ExtraFilters)
                .HasColumnType("jsonb");

            // ---- OrganizationAssignment relacije ----
            modelBuilder.Entity<OrganizationAssignment>()
                .HasOne(a => a.OrganizationUser)
                .WithMany()
                .HasForeignKey(a => a.OrganizationUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<OrganizationAssignment>()
                .HasOne(a => a.Destination)
                .WithMany()
                .HasForeignKey(a => a.DestinationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrganizationAssignment>()
                .HasOne(a => a.AssignedByUser)
                .WithMany()
                .HasForeignKey(a => a.AssignedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // ---- OrganizationRegionAssignment relacije ----
            modelBuilder.Entity<OrganizationRegionAssignment>()
                .HasOne(a => a.OrganizationUser)
                .WithMany(u => u.OrganizationRegionAssignments)
                .HasForeignKey(a => a.OrganizationUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<OrganizationRegionAssignment>()
                .HasOne(a => a.Region)
                .WithMany(r => r.OrganizationAssignments)
                .HasForeignKey(a => a.RegionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrganizationRegionAssignment>()
                .HasOne(a => a.AssignedByUser)
                .WithMany()
                .HasForeignKey(a => a.AssignedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<User>()
                .HasOne(u => u.ManagedRegion)
                .WithMany(r => r.ManagedUsers)
                .HasForeignKey(u => u.ManagedRegionId)
                .OnDelete(DeleteBehavior.SetNull);

            // ---- SubmissionQueue relacije ----
            modelBuilder.Entity<SubmissionQueue>()
                .HasOne(q => q.Destination)
                .WithMany()
                .HasForeignKey(q => q.DestinationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SubmissionQueue>()
                .HasOne(q => q.SubmittedByUser)
                .WithMany()
                .HasForeignKey(q => q.SubmittedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SubmissionQueue>()
                .HasOne(q => q.ReviewedByTOUser)
                .WithMany()
                .HasForeignKey(q => q.ReviewedByTOUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SubmissionQueue>()
                .HasOne(q => q.ReviewedByOwner)
                .WithMany()
                .HasForeignKey(q => q.ReviewedByOwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            // ---- Soft delete global query filter ----
            // EF Core automatski dodaje WHERE is_deleted = FALSE na sve upite
            modelBuilder.Entity<Destination>().HasQueryFilter(d => !d.IsDeleted);
            modelBuilder.Entity<Place>().HasQueryFilter(p => !p.IsDeleted);
            modelBuilder.Entity<Event>().HasQueryFilter(e => !e.IsDeleted);
            modelBuilder.Entity<Activity>().HasQueryFilter(a => !a.IsDeleted);

            modelBuilder.Entity<ReportTemplate>()
                .Property(t => t.Parameters)
                .HasColumnType("jsonb");
        }
    }
}
