import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ActivityDetail,
  ActivityFilterOptions,
  ActivityFilters,
  ActivityPagedResponse,
  ActivityStats,
  CategoryOption,
  CityOption,
  CreateActivityDto,
  DestinationOption,
  RegionOption,
  UpdateActivityDto,
} from './admin-activities.models';

@Injectable({ providedIn: 'root' })
export class AdminActivitiesService {
  private readonly base = '/api/admin/activities';

  constructor(private readonly http: HttpClient) {}

  getActivities(filters: ActivityFilters): Observable<ActivityPagedResponse> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.ids?.length) {
      filters.ids.forEach(id => { params = params.append('ids', id); });
    } else if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.categoryId !== 'all') {
      params = params.set('categoryId', filters.categoryId);
    }
    if (filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.difficulty !== 'all') {
      params = params.set('difficultyLevel', filters.difficulty);
    }
    if (filters.minRating !== 'all') {
      params = params.set('minAvgRating', filters.minRating);
    }
    if (filters.regionId !== 'all') {
      params = params.set('regionId', filters.regionId);
    }
    for (const [key, value] of Object.entries(filters.extraFilters)) {
      params = params.append('extraFilters', `${key}:${value}`);
    }

    return this.http.get<ActivityPagedResponse>(this.base, { params });
  }

  getStats(): Observable<ActivityStats> {
    return this.http.get<ActivityStats>(`${this.base}/stats`);
  }

  getFilterOptions(): Observable<ActivityFilterOptions> {
    return this.http.get<ActivityFilterOptions>(`${this.base}/filter-options`);
  }

  getCategories(): Observable<CategoryOption[]> {
    return this.http.get<CategoryOption[]>(`${this.base}/categories`);
  }

  getRegions(): Observable<RegionOption[]> {
    return this.http.get<RegionOption[]>('/api/admin/destinations/regions');
  }

  getDestination(id: string): Observable<{ id: string; name: string; latitude: number | null; longitude: number | null }> {
    return this.http.get<{ id: string; name: string; latitude: number | null; longitude: number | null }>(`/api/admin/destinations/${id}`);
  }

  searchDestinations(query: string): Observable<DestinationOption[]> {
    return this.http.get<{ total: number; items: { id: string; name: string; city?: string | null }[] }>(
      `/api/admin/destinations`,
      { params: { search: query, page: '1', pageSize: '8' } },
    ).pipe(map(r => r.items.map(d => ({ id: d.id, name: d.name, city: d.city ?? null }))));
  }

  getCities(regionId?: number): Observable<CityOption[]> {
    let params = new HttpParams();
    if (regionId !== undefined) params = params.set('regionId', regionId);
    return this.http.get<CityOption[]>('/api/cities', { params });
  }

  uploadImage(activityId: string, file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/${activityId}/images`, formData);
  }

  getById(id: string): Observable<ActivityDetail> {
    return this.http.get<ActivityDetail>(`${this.base}/${id}`);
  }

  create(dto: CreateActivityDto): Observable<ActivityDetail> {
    return this.http.post<ActivityDetail>(this.base, dto);
  }

  update(id: string, dto: UpdateActivityDto): Observable<ActivityDetail> {
    return this.http.put<ActivityDetail>(`${this.base}/${id}`, dto);
  }

  setHeroImage(activityId: string, imageId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${activityId}/images/${imageId}/hero`, {});
  }

  deleteImage(activityId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${activityId}/images/${imageId}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
