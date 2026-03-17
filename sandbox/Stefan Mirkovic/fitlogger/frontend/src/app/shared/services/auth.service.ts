import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:5000/api/auth';

  private _token = signal<string | null>(localStorage.getItem('token'));
  private _role = signal<string | null>(localStorage.getItem('role'));
  private _name = signal<string | null>(localStorage.getItem('name'));
  private _userId = signal<number | null>(Number(localStorage.getItem('userId')) || null);

  isLoggedIn = computed(() => !!this._token());
  isAdmin = computed(() => this._role() === 'admin');
  userName = computed(() => this._name());
  userId = computed(() => this._userId());

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  register(email: string, password: string, name: string) {
    return this.http.post(`${this.apiUrl}/register`, { email, password, name });
  }

  logout() {
    localStorage.clear();
    this._token.set(null);
    this._role.set(null);
    this._name.set(null);
    this._userId.set(null);
    this.router.navigate(['/login']);
  }

  getToken() {
    return this._token();
  }

  private saveSession(res: AuthResponse) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('role', res.role);
    localStorage.setItem('name', res.name);
    localStorage.setItem('userId', res.userId.toString());
    this._token.set(res.token);
    this._role.set(res.role);
    this._name.set(res.name);
    this._userId.set(res.userId);
  }
}
