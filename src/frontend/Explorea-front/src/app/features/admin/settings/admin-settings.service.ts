import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface AdminProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  email: string;
  role: string;
  roleLabel: string;
  region: string;
  status: string;
  memberSince: string;
  profileImageUrl: string | null;
}

export interface AdminUpdateProfileDto {
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
}

export interface AdminAppPreferencesDto {
  theme: string;
  language: string;
}

export interface AdminNotificationsDto {
  notificationsEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly api = '/api/admin/settings';

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<AdminProfileDto> {
    return this.http.get<AdminProfileDto>(`${this.api}/profile`);
  }

  updateProfile(dto: AdminUpdateProfileDto): Observable<AdminProfileDto> {
    return this.http.put<AdminProfileDto>(`${this.api}/profile`, dto);
  }

  getPreferences(): Observable<AdminAppPreferencesDto> {
    return this.http.get<AdminAppPreferencesDto>(`${this.api}/preferences`);
  }

  getNotifications(): Observable<AdminNotificationsDto> {
    return this.http.get<AdminNotificationsDto>(`${this.api}/notifications`);
  }

  uploadProfilePhoto(file: File): Observable<AdminProfileDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<AdminProfileDto>(`${this.api}/profile-photo`, formData);
  }

  deleteProfilePhoto(): Observable<AdminProfileDto> {
    return this.http.delete<AdminProfileDto>(`${this.api}/profile-photo`);
  }
}
