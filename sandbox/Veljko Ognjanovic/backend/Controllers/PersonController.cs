using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class PersonController : ControllerBase
{
    private readonly AppDbContext _context;

    public PersonController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public IActionResult Add(Person p)
    {
        _context.Persons.Add(p);
        _context.SaveChanges();
        return Ok(p);
    }
}