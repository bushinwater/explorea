using Explorea.API.DTOs.Activity;

namespace Explorea.Server.Services.Interfaces
{
  public interface IActivityService
  {
    Task<ActivityDetailDto?> GetBySlugAsync(string slug);
  }
}