namespace EventsDemoApi.Models;

public class Event{
  public int Id { get; set; }
  public string Title { get; set; } = string.Empty;
  public string? Description { get; set; }
  public DateTime EventDate { get; set; }
  public string? Location { get; set; }
  public bool IsCompleted { get; set; }
  public DateTime Created { get; set; }
  public DateTime Updated { get; set; }

  public bool IsDeleted { get; set; }
  public DateTime? DeletedAt { get; set; }
}