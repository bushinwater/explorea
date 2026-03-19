export interface AuthResponse {
  token: string;
  role: string;
  fullName: string;
  userId: string;
}

export interface TodoItem {
  id: number;
  title: string;
  description?: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface PredefinedTask {
  id: number;
  title: string;
  description?: string;
  createdAt: string;
}

export interface UserAdmin {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  todoCount: number;
}

export interface AdminStats {
  totalUsers: number;
  totalTodos: number;
  completedTodos: number;
  predefinedTasks: number;
}
