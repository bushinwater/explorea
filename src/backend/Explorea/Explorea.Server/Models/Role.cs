using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("roles")]
    public class Role
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(50), Column("name")]
        public string Name { get; set; } = null!;

        [MaxLength(255), Column("description")]
        public string? Description { get; set; }

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
