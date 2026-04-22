import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
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

  createUser(dto: UpsertAdminUserDto): Observable<UserDirectoryUser> {
    return this.http.post<UserDirectoryUser>(this.api, dto);
  }

  updateUser(dto: UpdateAdminUserDto): Observable<UserDirectoryUser> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const emailExists = this.users.some(
      (user) => user.id !== dto.id && user.email.toLowerCase() === normalizedEmail,
    );

    if (emailExists) {
      return throwError(() => new Error(this.ui.t('users.error.email_exists_update')));
    }

    const index = this.users.findIndex((user) => user.id === dto.id);
    if (index === -1) {
      return throwError(() => new Error(this.ui.t('users.error.not_found')));
    }

    const updated: UserDirectoryUser = {
      ...this.users[index],
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      role: dto.role,
      regionName: dto.region,
      status: dto.status,
      gender: dto.gender ?? 'unknown',
      age: dto.age,
    };

    this.users[index] = updated;

    return of(updated).pipe(delay(250));
  }

  deleteUser(id: string): Observable<void> {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) {
      return throwError(() => new Error(this.ui.t('users.error.not_found')));
    }

    this.users.splice(index, 1);

    return of(void 0).pipe(delay(250));
  }
}

interface AdminUserDirectoryRegionResponse {
  id: number;
  name: string;
}
