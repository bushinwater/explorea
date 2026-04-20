namespace Explorea.API.DTOs.Search
{
  public class SearchPageListQueryDto
  { 
    public string Tab {get; set;} = null!;
    public string? Query {get; set;}

    public List<int>? RegionsIds {get; set;}
    public List<int>? CityIds {get; set;}
    public List<Guid>? DestinationsIds {get; set;}

    public decimal? MinRating {get; set;}
    public decimal? MinPrice {get; set;}
    public decimal? MaxPrice {get; set;}

    public bool? OpenNow {get; set;}

    public List<int>? PlaceTypeIds {get; set;}
    public List<int>? ActivityCategoryIds {get; set;}
    public List<int>? EventTypeIds {get; set;}

    public string? SortBy {get; set;}

    public int Page {get; set;} = 1;
    public int PageSize {get; set;} = 12;

    public double? UserLat {get; set;}
    public double? UserLng {get; set;}
    public double? RadiusKm {get; set;}
  }
}