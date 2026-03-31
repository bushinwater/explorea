// interni repository model, pomoc pri projekciji za search
namespace Explorea.Server.Repositories.Models
{
  public class SearchProjection<T>
  {
    public T Entity {get; set;} = default!;

    public double NameSimilarity {get; set;} 
    public double? CitySimilarity {get; set;} 
    public double? DestinationSimilarity {get; set;} 
    public double? PlaceSimilarity {get; set;} 
    public double? TypeSimilarity {get; set;} 
    public double? CategorySimilarity {get; set;} 
  }
}