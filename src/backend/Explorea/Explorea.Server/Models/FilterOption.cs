using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Explorea.API.Models
{
    [Table("filter_options")]
    public class FilterOption
    {
        [Key, Column("id")]
        public int Id { get; set; }

        [Column("filter_definition_id")]
        public int FilterDefinitionId { get; set; }

        [Required, MaxLength(100), Column("option_value")]
        public string OptionValue { get; set; } = null!;

        [Required, MaxLength(200), Column("option_label")]
        public string OptionLabel { get; set; } = null!;

        [Column("sort_order")]
        public int SortOrder { get; set; } = 0;

        [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
        [Column("created_by")] public Guid? CreatedBy { get; set; }
        [Column("updated_by")] public Guid? UpdatedBy { get; set; }

        [ForeignKey("FilterDefinitionId")]
        public FilterDefinition FilterDefinition { get; set; } = null!;
    }
}
