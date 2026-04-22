using Explorea.API.DTOs.Home;

namespace Explorea.Server.Services.Interfaces 
{
    public interface IHomeService
    {
      Task<HomeDataDto> GetHomeDataAsync(HomeQueryDto query);
      Task<RecommendationsDto> GetRecommendationsAsync(Guid? userId, double? userLat, double? userLng);
    }
}