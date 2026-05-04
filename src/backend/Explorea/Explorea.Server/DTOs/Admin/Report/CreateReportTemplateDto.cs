using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Admin.Report
{
    public class CreateReportTemplateDto
    {
        [Required, MaxLength(200)]
        public string Name { get; set; } = null!;

        [Required]
        public string Parameters { get; set; } = null!;
    }
}
