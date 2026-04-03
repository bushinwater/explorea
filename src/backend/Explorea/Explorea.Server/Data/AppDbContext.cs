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
        public DbSet<Country> Countries { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ---- Composite primary keys ----
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

            // ---- Activity.ExtraData kao JSONB ----
            modelBuilder.Entity<Activity>()
                .Property(a => a.ExtraData)
                .HasColumnType("jsonb");

            // ---- Soft delete global query filter ----
            // EF Core automatski dodaje WHERE is_deleted = FALSE na sve upite
            modelBuilder.Entity<Destination>().HasQueryFilter(d => !d.IsDeleted);
            modelBuilder.Entity<Place>().HasQueryFilter(p => !p.IsDeleted);
            modelBuilder.Entity<Event>().HasQueryFilter(e => !e.IsDeleted);
            modelBuilder.Entity<Activity>().HasQueryFilter(a => !a.IsDeleted);
        }
    }
}
