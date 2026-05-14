namespace Explorea.Server.Services.Interfaces
{
    public interface ICloudinaryService
    {
        Task<string> UploadImageAsync(IFormFile file, string folder);
        Task<string> UploadLandscapeAsync(IFormFile file, string folder);
    }
}
