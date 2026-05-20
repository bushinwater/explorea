namespace Explorea.API.DTOs.Admin.Activity
{
    public class AdminActivityFilterOptionsDto
    {
        public List<string> Difficulties { get; set; } = [];
        public List<CategoryItem> Categories { get; set; } = [];
        public RegionItem? ManagedRegion { get; set; }

        public record CategoryItem(int Id, string Name);
        public record RegionItem(int Id, string Name);
    }
}
