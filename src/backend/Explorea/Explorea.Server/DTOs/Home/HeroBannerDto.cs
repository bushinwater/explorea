namespace Explorea.API.DTOs.Home
{
  public class HeroBannerDto
  { 
    public Guid Id {get; set;}
    public string Title {get; set;} = null!;
    public string Subtitle {get; set;} = null!;
    public string ImageUrl {get; set;} = null!;
    public string LinkType {get; set;} = null!;
    public string LinkSlug {get; set;} = null!;
  }
}