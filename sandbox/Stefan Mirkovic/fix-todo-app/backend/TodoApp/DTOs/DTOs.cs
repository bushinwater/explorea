namespace TodoApp.DTOs;

// Auth
public record RegisterRequest(string Email, string Password, string FullName);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, string Role, string FullName, string UserId);

// Todo
public record CreateTodoRequest(string Title, string? Description);
public record TodoResponse(int Id, string Title, string? Description, bool IsCompleted, DateTime CreatedAt, DateTime? CompletedAt);

// Predefined Tasks
public record CreatePredefinedTaskRequest(string Title, string? Description);
public record PredefinedTaskResponse(int Id, string Title, string? Description, DateTime CreatedAt);

// Admin
public record UserAdminResponse(string Id, string Email, string FullName, string Role, DateTime CreatedAt, int TodoCount);
public record AdminStatsResponse(int TotalUsers, int TotalTodos, int CompletedTodos, int PredefinedTasks);
