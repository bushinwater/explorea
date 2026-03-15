using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;

    public AuthController(AppDbContext context)
    {
        _context = context;
    }

    [Microsoft.AspNetCore.Mvc.HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] Login login)
    {
      var user = await _context.Users
    .FirstOrDefaultAsync<User>(u => u.Username == login.Username && u.Password == login.Password);
        if (user == null)
            return Unauthorized("Neispravno korisničko ime ili lozinka");

        // vraćamo minimalne podatke, uključujući ulogu
        return Ok(new
        {
            user.Id,
            user.Username,
            user.Role
        });
    }
}