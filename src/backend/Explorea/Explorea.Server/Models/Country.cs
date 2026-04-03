using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("countries")]
    public class Country
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(100), Column("name")]
        public string Name { get; set; } = null!;

        [Required, MaxLength(3), Column("code")]
        public string Code { get; set; } = null!;

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }
    }
}