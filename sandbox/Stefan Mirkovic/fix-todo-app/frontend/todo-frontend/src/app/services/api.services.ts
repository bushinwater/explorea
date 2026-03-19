import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AdminStats, PredefinedTask, TodoItem, UserAdmin } from '../models/models';

const BASE = 'http://localhost:5000/api';

// singlton
// inject-ujemo httpclient kako bi ovaj servis mogao da salje http zahteve preko this.http
@Injectable({ providedIn: 'root' })
export class TodoService {

    // ubacujemo http client za slanje http zahteva
    private http = inject(HttpClient);

    // salje GET zahtev na backend
    getAll() {
        return this.http.get<TodoItem[]>(`${BASE}/todos`);
    }

    create(title: string, description?: string) {
        return this.http.post<TodoItem>(`${BASE}/todos`, { title, description });
    }

    toggle(id: number) {
        return this.http.patch<TodoItem>(`${BASE}/todos/${id}/toggle`, {}); // parcijalni update, saljem samo deo koji menjam
    }

    delete(id: number) {
        return this.http.delete(`${BASE}/todos/${id}`);
    }

    getPredefined() {
        return this.http.get<PredefinedTask[]>(`${BASE}/todos/predefined`);
    }
}

@Injectable({ providedIn: 'root' })
export class AdminService {
    private http = inject(HttpClient);

    getStats() {
        return this.http.get<AdminStats>(`${BASE}/admin/stats`);
    }

    getUsers() {
        return this.http.get<UserAdmin[]>(`${BASE}/admin/users`);
    }

    deleteUser(id: string) {
        return this.http.delete(`${BASE}/admin/users/${id}`);
    }

    getPredefined() {
        return this.http.get<PredefinedTask[]>(`${BASE}/admin/predefined`);
    }

    createPredefined(title: string, description?: string) {
        return this.http.post<PredefinedTask>(`${BASE}/admin/predefined`, { title, description });
    }

    deletePredefined(id: number) {
        return this.http.delete(`${BASE}/admin/predefined/${id}`);
    }
}
