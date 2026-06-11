import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  AdminUserDetails,
  AdminUserOwnedEntity,
  PagedResponse,
  UpdateAdminUserDto,
  UpsertAdminUserDto,
  UserDirectoryFilters,
  UserDirectoryStats,
  UserDirectoryUser,
} from '@shared/models';
import { Observable, map, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminUserDirectoryService {
  private readonly api = '/api/admin/users';
  private readonly regionIdByName = new Map<string, number>();

  constructor(private readonly http: HttpClient) {}

  getUsers(filters: UserDirectoryFilters): Observable<PagedResponse<UserDirectoryUser>> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.role !== 'all') {
      params = params.set('role', filters.role);
    }

    if (filters.region !== 'all') {
      const regionId = this.regionIdByName.get(filters.region);
      if (regionId != null) {
        params = params.set('regionId', regionId);
      }
    }

    if (filters.gender !== 'all') {
      params = params.set('gender', filters.gender);
    }

    if (filters.ageBucket !== 'all') {
      params = params.set('ageBucket', filters.ageBucket);
    }

    if (filters.activityStatus !== 'all') {
      params = params.set('activityStatus', filters.activityStatus);
    }

    return this.http.get<PagedResponse<UserDirectoryUser>>(this.api, { params });
  }

  getStats(): Observable<UserDirectoryStats> {
    return this.http.get<UserDirectoryStats>(`${this.api}/stats`);
  }

  getRegions(): Observable<string[]> {
    return this.http.get<AdminUserDirectoryRegionResponse[]>(`${this.api}/regions`).pipe(
      tap((regions) => {
        this.regionIdByName.clear();
        for (const region of regions) {
          this.regionIdByName.set(region.name, region.id);
        }
      }),
      map((regions) => regions.map((region) => region.name)),
    );
  }

  getCountries(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>('/api/admin/destinations/countries');
  }

  createUser(dto: UpsertAdminUserDto): Observable<UserDirectoryUser> {
    return this.http.post<UserDirectoryUser>(this.api, dto);
  }

  updateUser(dto: UpdateAdminUserDto): Observable<UserDirectoryUser> {
    const { id, ...payload } = dto;
    return this.http.put<UserDirectoryUser>(`${this.api}/${id}`, payload);
  }

  getDeletedUsers(page: number, pageSize: number): Observable<PagedResponse<UserDirectoryUser>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResponse<UserDirectoryUser>>(`${this.api}/deleted`, { params });
  }

  restoreUser(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/${id}/restore`, {});
  }

  uploadAvatar(userId: string, file: File): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ avatarUrl: string }>(`${this.api}/${userId}/avatar`, formData);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  getUserDetails(id: string): Observable<AdminUserDetails> {
    return this.http.get<AdminUserDetails>(`${this.api}/${id}/details`);
  }

  getUserOwnedEntities(id: string, type: 'place' | 'event'): Observable<AdminUserOwnedEntity[]> {
    return this.http.get<AdminUserOwnedEntity[]>(`${this.api}/${id}/owned-entities`, { params: { type } });
  }
}

interface AdminUserDirectoryRegionResponse {
  id: number;
  name: string;
}
