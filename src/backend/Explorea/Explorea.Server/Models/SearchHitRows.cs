namespace Explorea.Server.Models
{
  public class DestinationSearchHitRow
  {
    public Guid Id {get; set;}
    public double FtsRank {get; set;}
    public double NameSimilarity {get; set;}
    public double? CitySimilarity {get; set;}
  }

  public class PlaceSearchHitRow
  {
    public Guid Id {get; set;}
    public double FtsRank {get; set;}
    public double NameSimilarity {get; set;}
    public double? CitySimilarity {get; set;}
    public double? DestinationSimilarity {get; set;}
    public double? TypeSimilarity {get; set;}
  }

  public class EventSearchHitRow
  {
    public Guid Id {get; set;}
    public double FtsRank {get; set;}
    public double NameSimilarity {get; set;}
    public double? CitySimilarity {get; set;}
    public double? DestinationSimilarity {get; set;}
    public double? PlaceSimilarity {get; set;}
    public double? TypeSimilarity {get; set;}
  }
  
  public class ActivitySearchHitRow
  {
    public Guid Id {get; set;}
    public double FtsRank {get; set;}
    public double NameSimilarity {get; set;}
    public double? CitySimilarity {get; set;}
    public double? DestinationSimilarity {get; set;}
    public double? PlaceSimilarity {get; set;}
    public double? CategorySimilarity {get; set;}
  }
}