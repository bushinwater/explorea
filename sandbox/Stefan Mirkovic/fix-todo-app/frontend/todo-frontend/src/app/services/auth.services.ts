import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// angularov servis za navigaciju izmedju stranica
import { Router } from '@angular/router';
// tap sluzi da pogledamo podatke koji prolaze kroz observable, i da uradim nesto sa njima, a vratimo ih netaktnute
import { tap } from 'rxjs/operators';
import { AuthResponse } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private apiUrl = 'http://localhost:5000/api/auth';

    private http = inject(HttpClient);
    private router = inject(Router);

    private _token = signal<string | null>(localStorage.getItem('token'));
    private _role = signal<string | null>(localStorage.getItem('role'));
    private _fullName = signal<string | null>(localStorage.getItem('fullName'));
    private _userId = signal<string | null>(localStorage.getItem('userId'));

    isLoggedIn = computed(() => !!this._token()); // !! pretvara bilo koju vrednost u pravi boolean
    isAdmin = computed(() => this._role() === 'Admin');
    fullName = computed(() => this._fullName());
    userId = computed(() => this._userId());

    private saveSession(res: AuthResponse) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.role);
        localStorage.setItem('fullName', res.fullName);
        localStorage.setItem('userId', res.userId);
        this._token.set(res.token);
        this._role.set(res.role);
        this._fullName.set(res.fullName);
        this._userId.set(res.userId);
    }

    // koristimo tap, kako komponenta ne bi znala nista o sesiji
    login(email: string, password: string) {
        return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
            tap(res => this.saveSession(res))
        );
    }

    register(email: string, password: string, fullName: string) {
        return this.http.post(`${this.apiUrl}/register`, { email, password, fullName });
    }

    logout() {
        localStorage.clear();
        this._token.set(null);
        this._role.set(null);
        this._fullName.set(null);
        this._userId.set(null);
        this.router.navigate(['/login']);
    }

    getToken() {
        return this._token();
    }


}
