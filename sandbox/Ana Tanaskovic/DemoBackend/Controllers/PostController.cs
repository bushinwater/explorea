using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/posts")]
public class PostController : ControllerBase
{
    private readonly AppDbContext _context;

    public PostController(AppDbContext context)
    {
        _context = context;
    }

    // Svi mogu da vide postove
    [HttpGet]
    public async Task<IActionResult> GetPosts()
    {
        var posts = await _context.Posts
            .Include(p => p.User)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(posts);
    }

    // Samo admin može da doda post
    [HttpPost]
    [HttpPost]
public async Task<IActionResult> AddPost([FromBody] Post post)
{
    if (!IsAdmin())
        return Unauthorized("Samo admin može da dodaje postove.");

    // Postavi UserId iz headera
    if (Request.Headers.TryGetValue("UserId", out var userIdStr) &&
        int.TryParse(userIdStr, out int userId))
    {
        post.UserId = userId;
    }
    else
    {
        return BadRequest("UserId nije prosleđen.");
    }

    post.CreatedAt = DateTime.UtcNow;
    _context.Posts.Add(post);
    await _context.SaveChangesAsync();
    return Ok(post);
}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(int id, [FromBody] Post updatedPost)
    {
        if (!IsAdmin())
            return Unauthorized("Samo admin može da menja postove.");

        var post = await _context.Posts.FindAsync(id);
        if (post == null)
            return NotFound();

        post.Title = updatedPost.Title;
        post.Content = updatedPost.Content;
        await _context.SaveChangesAsync();
        return Ok(post);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(int id)
    {
        if (!IsAdmin())
            return Unauthorized("Samo admin može da briše postove.");

        var post = await _context.Posts.FindAsync(id);
        if (post == null)
            return NotFound();

        _context.Posts.Remove(post);
        await _context.SaveChangesAsync();
        return Ok();
    }

    private bool IsAdmin()
    {
        if (Request.Headers.TryGetValue("UserId", out var userIdStr) &&
            int.TryParse(userIdStr, out int userId))
        {
            var user = _context.Users.Find(userId);
            return user != null && user.Role?.ToLower() == "admin";
        }
        return false;
    }
}