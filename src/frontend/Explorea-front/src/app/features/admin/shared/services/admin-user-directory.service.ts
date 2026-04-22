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
import { Observable, delay, map, of, tap, throwError } from 'rxjs';
import { AdminUiPreferencesService } from '../../core/services/admin-ui-preferences.service';

@Injectable({ providedIn: 'root' })
export class AdminUserDirectoryService {
  private readonly api = '/api/admin/users';
  private readonly regionIdByName = new Map<string, number>();

  constructor(
    private readonly http: HttpClient,
    private readonly ui: AdminUiPreferencesService,
  ) {}

  private readonly users: UserDirectoryUser[] = [
    {
      id: '1',
      firstName: 'Stefan',
      lastName: 'Nemanja',
      email: 'stefan.n@explorea.rs',
      role: 'super_admin',
      regionName: 'Sve regije',
      status: 'active',
      gender: 'male',
      age: 33,
      flagged: false,
      lastActivityAt: '2026-04-19T19:20:00Z',
    },
    {
      id: '2',
      firstName: 'Milica',
      lastName: 'Jovanovic',
      email: 'm.jovanovic@vojvodina-tourism.rs',
      role: 'tourist_organization',
      regionName: 'Vojvodina',
      status: 'active',
      gender: 'female',
      age: 29,
      flagged: false,
      lastActivityAt: '2026-04-19T18:10:00Z',
    },
    {
      id: '3',
      firstName: 'Dragan',
      lastName: 'Petrovic',
      email: 'dragan.p@belgrade-stays.com',
      role: 'place_owner',
      regionName: 'Beograd',
      status: 'active',
      gender: 'male',
      age: 47,
      flagged: false,
      lastActivityAt: '2026-04-19T15:40:00Z',
    },
    {
      id: '4',
      firstName: 'Ana',
      lastName: 'Brnabic',
      email: 'a.brnabic@sumadija-ops.rs',
      role: 'tourist_organization',
      regionName: 'Sumadija',
      status: 'pending',
      gender: 'female',
      age: 24,
      flagged: false,
      lastActivityAt: null,
    },
    {
      id: '5',
      firstName: 'Nikola',
      lastName: 'Tesla',
      email: 'n.tesla@ni-power.com',
      role: 'place_owner',
      regionName: 'Juzna Srbija',
      status: 'revoked',
      gender: 'male',
      age: 39,
      flagged: true,
      lastActivityAt: '2026-04-17T21:00:00Z',
    },
    {
      id: '6',
      firstName: 'Jelena',
      lastName: 'Matic',
      email: 'jelena.matic@backa-tourism.rs',
      role: 'tourist_organization',
      regionName: 'Backa',
      status: 'active',
      gender: 'female',
      age: 31,
      flagged: false,
      lastActivityAt: '2026-04-19T14:20:00Z',
    },
    {
      id: '7',
      firstName: 'Petar',
      lastName: 'Markovic',
      email: 'petar.markovic@hosthub.rs',
      role: 'place_owner',
      regionName: 'Zapadna Srbija',
      status: 'pending',
      gender: 'male',
      age: 22,
      flagged: false,
      lastActivityAt: '2026-04-18T10:45:00Z',
    },
    {
      id: '8',
      firstName: 'Marija',
      lastName: 'Savic',
      email: 'marija.savic@explorea.rs',
      role: 'super_admin',
      regionName: 'Sve regije',
      status: 'active',
      gender: 'female',
      age: 35,
      flagged: false,
      lastActivityAt: '2026-04-19T16:55:00Z',
    },
  ];

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
    const normalizedEmail = dto.email.trim().toLowerCase();
    const emailExists = this.users.some((user) => user.email.toLowerCase() === normalizedEmail);

    if (emailExists) {
      return throwError(() => new Error(this.ui.t('users.error.email_exists_create')));
    }

    const created: UserDirectoryUser = {
      id: crypto.randomUUID(),
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      role: dto.role,
      regionName: dto.region,
      status: dto.status,
      gender: dto.gender ?? 'unknown',
      age: dto.age,
      flagged: false,
      lastActivityAt: null,
      avatarUrl: null,
    };

    this.users.unshift(created);

    return of(created).pipe(delay(250));
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
