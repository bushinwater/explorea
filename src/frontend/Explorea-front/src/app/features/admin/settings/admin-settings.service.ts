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
  bio: string | null;
}

export interface AdminUpdateProfileDto {
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  bio: string | null;
}

export interface AdminAppPreferencesDto {
  theme: string;
  language: string;
  defaultAdminPage: string;
}

export interface AdminUpdateAppPreferencesDto {
  theme: string;
  language: string;
  defaultAdminPage: string;
}

export interface AdminNotificationsDto {
  notificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  reportTopics: string[];
  priority: string;
  deliveryFrequencyDays: number;
  deliveryHour: number;
}

export interface AdminUpdateNotificationsDto {
  notificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  reportTopics: string[];
  priority: string;
  deliveryFrequencyDays: number;
  deliveryHour: number;
}

export interface AdminAdministrationOverviewDto {
  stats: AdminAdministrationStatDto[];
  settings: AdminAdministrationSettingDto[];
  systemToggles: AdminSystemToggleDto[];
}

export interface AdminAdministrationStatDto {
  icon: string;
  label: string;
  value: string;
  description: string;
}

export interface AdminAdministrationSettingDto {
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
}

export interface AdminSystemToggleDto {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
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

  updatePreferences(dto: AdminUpdateAppPreferencesDto): Observable<AdminAppPreferencesDto> {
    return this.http.put<AdminAppPreferencesDto>(`${this.api}/preferences`, dto);
  }

  getNotifications(): Observable<AdminNotificationsDto> {
    return this.http.get<AdminNotificationsDto>(`${this.api}/notifications`);
  }

  updateNotifications(dto: AdminUpdateNotificationsDto): Observable<AdminNotificationsDto> {
    return this.http.put<AdminNotificationsDto>(`${this.api}/notifications`, dto);
  }

  uploadProfilePhoto(file: File): Observable<AdminProfileDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<AdminProfileDto>(`${this.api}/profile-photo`, formData);
  }

  getAdministration(): Observable<AdminAdministrationOverviewDto> {
    return this.http.get<AdminAdministrationOverviewDto>(`${this.api}/administration`);
  }

  deleteProfilePhoto(): Observable<AdminProfileDto> {
    return this.http.delete<AdminProfileDto>(`${this.api}/profile-photo`);
  }
}
