using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Admin.Ai
{
    public class AdminAiChatRequestDto
    {
        [Required]
        [MaxLength(1000)]
        public string Message { get; set; } = string.Empty;

        public List<AdminAiChatMessageDto> History { get; set; } = new();
    }

    public class AdminAiChatMessageDto
    {
        [Required]
        public string Role { get; set; } = "user";

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;
    }

    public class AdminAiChatResponseDto
    {
        public string Message { get; set; } = string.Empty;
        public List<AdminAiInsightDto> Insights { get; set; } = new();
        public List<AdminAiQuickActionDto> QuickActions { get; set; } = new();
    }

    public class AdminAiInsightDto
    {
        public string Type { get; set; } = "neutral";
        public string Icon { get; set; } = "auto_awesome";
        public string Text { get; set; } = string.Empty;
    }

    public class AdminAiQuickActionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Icon { get; set; } = "bolt";
        public string Label { get; set; } = string.Empty;
        public string Route { get; set; } = "/admin/dashboard";
    }
}
