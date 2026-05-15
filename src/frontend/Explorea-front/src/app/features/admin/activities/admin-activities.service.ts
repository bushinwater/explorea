import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityDetail,
  ActivityFilters,
  ActivityPagedResponse,
  ActivityStats,
  CategoryOption,
  CityOption,
  CreateActivityDto,
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

    if (filters.search.trim()) {
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

    return this.http.get<ActivityPagedResponse>(this.base, { params });
  }

  getStats(): Observable<ActivityStats> {
    return this.http.get<ActivityStats>(`${this.base}/stats`);
  }

  getCategories(): Observable<CategoryOption[]> {
    return this.http.get<CategoryOption[]>(`${this.base}/categories`);
  }

  getRegions(): Observable<RegionOption[]> {
    return this.http.get<RegionOption[]>('/api/admin/destinations/regions');
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

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
