import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UpdatePreferencesDto, UpdateUserDto, UserProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = '/api/users';

  constructor(private http: HttpClient) {}

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.api}/me`);
  }

  updateMe(dto: UpdateUserDto): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.api}/me`, dto);
  }

  updatePreferences(dto: UpdatePreferencesDto): Observable<void> {
    return this.http.put<void>(`${this.api}/me/preferences`, dto);
  }
}
