namespace Explorea.API.DTOs.User
{
    public class UpdateInterestsDto
    {
        public List<int> InterestTagIds { get; set; } = new();
    }
}