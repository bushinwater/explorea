import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Auth {
  private userSubject = new BehaviorSubject<any>(
    JSON.parse(localStorage.getItem('currentUser') ?? 'null'),
  );
  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(username: string, password: string) {
    return this.http.post<any>('http://localhost:5023/api/auth/login', { username, password }).pipe(
      tap((user) => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.userSubject.next(user);
      }),
    );
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.userSubject.next(null);
  }

  getCurrentUser() {
    return this.userSubject.value;
  }
}
