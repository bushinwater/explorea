using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("regions")]
    public class Region
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(100), Column("name")]
        public string Name { get; set; } = null!;

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        public ICollection<City> Cities { get; set; } = new List<City>();
        public ICollection<User> ManagedUsers { get; set; } = new List<User>();
        public ICollection<OrganizationRegionAssignment> OrganizationAssignments { get; set; } = new List<OrganizationRegionAssignment>();
    }
}
