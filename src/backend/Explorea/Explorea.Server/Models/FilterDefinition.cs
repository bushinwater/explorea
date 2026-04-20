using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("filter_definitions")]
    public class FilterDefinition
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(20), Column("entity_type")]
        public string EntityType { get; set; } = null!;

        [Column("type_id")]
        public int TypeId { get; set; }

        [Required, MaxLength(100), Column("filter_key")]
        public string FilterKey { get; set; } = null!;

        [Required, MaxLength(200), Column("filter_label")]
        public string FilterLabel { get; set; } = null!;

        // 'boolean' | 'range_int' | 'range_decimal' | 'select' | 'multi_select'
        [Required, MaxLength(20), Column("filter_type")]
        public string FilterType { get; set; } = null!;

        [Column("sort_order")]
        public int SortOrder { get; set; } = 0;

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        public ICollection<FilterOption> Options { get; set; } = new List<FilterOption>();
    }
}
