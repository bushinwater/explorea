namespace Explorea.Server.Services
{
    internal record PendingRegistrationData(
        string FirstName,
        string LastName,
        string Email,
        string PasswordHash,
        string? Gender,
        DateOnly? DateOfBirth);
}
