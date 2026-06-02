using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class CloudinaryService : ICloudinaryService
    {
        private readonly Cloudinary? _cloudinary;

        // public CloudinaryService(IConfiguration config)
        // {
        //     var account = new Account(
        //         config["Cloudinary:CloudName"],
        //         config["Cloudinary:ApiKey"],
        //         config["Cloudinary:ApiSecret"]
        //     );
        //     _cloudinary = new Cloudinary(account) { Api = { Secure = true } };
        // }
        public CloudinaryService(IConfiguration config)
        {
            var cloudName = config["Cloudinary:CloudName"];
            var apiKey = config["Cloudinary:ApiKey"];
            var apiSecret = config["Cloudinary:ApiSecret"];

            if(string.IsNullOrWhiteSpace(cloudName)
             || string.IsNullOrWhiteSpace(apiKey)
             || string.IsNullOrWhiteSpace(apiSecret)
            )
            {
                _cloudinary = null;
                return;
            }
            
            var account = new Account(cloudName, apiKey, apiSecret);
            _cloudinary = new Cloudinary(account) { Api = { Secure = true } };
        }

        public async Task<string> UploadImageAsync(IFormFile file, string folder)
        {
            if(_cloudinary == null) throw new InvalidOperationException("Cloudinary is not configured.");
            
            await using var stream = file.OpenReadStream();

            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder,
                Transformation = new Transformation()
                    .Width(400).Height(400).Crop("fill").Gravity("face")
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
                throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

            return result.SecureUrl.ToString();
        }

        public async Task<string> UploadLandscapeAsync(IFormFile file, string folder)
        {
            if (_cloudinary == null) throw new InvalidOperationException("Cloudinary is not configured.");

            await using var stream = file.OpenReadStream();

            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder,
                Transformation = new Transformation().Width(1280).Height(720).Crop("fill")
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
                throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

            return result.SecureUrl.ToString();
        }

        public async Task<string> UploadRawAsync(IFormFile file, string folder)
        {
            if (_cloudinary == null) throw new InvalidOperationException("Cloudinary is not configured.");

            await using var stream = file.OpenReadStream();

            var uploadParams = new RawUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
                throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

            return result.SecureUrl.ToString();
        }

    }
}
