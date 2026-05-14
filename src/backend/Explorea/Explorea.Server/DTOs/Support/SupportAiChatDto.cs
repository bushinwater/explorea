using System.ComponentModel.DataAnnotations;

namespace Explorea.API.DTOs.Support
{
    public class SupportAiChatRequestDto
    {
        [Required]
        public string Message { get; set; } = null!;

        [Required]
        public string SessionId { get; set; } = null!;

        public List<SupportAiChatMessageDto> History { get; set; } = new();
    }

    public class SupportAiChatMessageDto
    {
        public string Role { get; set; } = null!;
        public string Content { get; set; } = null!;
    }

    public class SupportAiChatResponseDto
    {
        public string Reply { get; set; } = null!;
        public string SessionId { get; set; } = null!;
    }
}
