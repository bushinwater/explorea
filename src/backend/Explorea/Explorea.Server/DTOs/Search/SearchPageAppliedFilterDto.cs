namespace Explorea.API.DTOs.Search
{
  public class SearchPageAppliedFilterDto
  {
    public List<int>? RegionsIds {get; set;}
    public List<int>? CityIds {get; set;}
    public List<Guid>? DestinationIds {get; set;}

    public decimal? MinRating {get; set;}
    public decimal? MinPrice {get; set;}
    public decimal? MaxPrice {get; set;}

    public bool? OpenNow {get; set;}

    public List<int>? PlaceTypeIds {get; set;}
    public List<int>? ActivityCategoryIds {get; set;}
    public List<int>? EventTypeIds {get; set;}
  }
}