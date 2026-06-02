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
  CountryOption,
  CreateActivityDto,
  DestinationOption,
  InterestTagOption,
  RegionOption,
  UpdateActivityDto,
} from './admin-activities.models';
import { FilterDefinition } from '../../../core/services/lookup.service';

@Injectable({ providedIn: 'root' })
export class AdminActivitiesService {
  private readonly base = '/api/admin/activities';

  constructor(private readonly http: HttpClient) {}

  getActivities(filters: ActivityFilters): Observable<ActivityPagedResponse> {
    return this.getActivityList(this.base, filters);
  }

  getDeletedActivities(filters: ActivityFilters): Observable<ActivityPagedResponse> {
    return this.getActivityList(`${this.base}/deleted`, filters, true);
  }

  private getActivityList(
    url: string,
    filters: ActivityFilters,
    deletedOnly = false,
  ): Observable<ActivityPagedResponse> {
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
    if (!deletedOnly && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.difficulty !== 'all') {
      params = params.set('difficultyLevel', filters.difficulty);
    }
    if (!deletedOnly && filters.minRating !== 'all') {
      params = params.set('minAvgRating', filters.minRating);
    }
    if (filters.regionId !== 'all') {
      params = params.set('regionId', filters.regionId);
    }
    if (!deletedOnly) {
      for (const [key, value] of Object.entries(filters.extraFilters)) {
        params = params.append('extraFilters', `${key}:${value}`);
      }
    }

    if (!deletedOnly && filters.sortBy !== 'none') {
      params = params.set('sortBy', filters.sortBy);
    }

    return this.http.get<ActivityPagedResponse>(url, { params });
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
    return this.http.get<any[]>('/api/admin/destinations/regions').pipe(
      map(items => items.map(r => ({ id: r.id, name: r.name, countryId: r.countryId ?? null }))),
    );
  }

  getCountries(): Observable<CountryOption[]> {
    return this.http.get<CountryOption[]>('/api/admin/destinations/countries');
  }

  getDestination(id: string): Observable<{ id: string; name: string; latitude: number | null; longitude: number | null; regionId: number | null; countryId: number | null }> {
    return this.http.get<any>(`/api/admin/destinations/${id}`).pipe(
      map(item => ({
        id: item.id,
        name: item.name,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        regionId: item.regionId ?? null,
        countryId: item.countryId ?? null,
      })),
    );
  }

  searchDestinations(query: string, regionId?: number): Observable<DestinationOption[]> {
    const params: Record<string, string> = { search: query, page: '1', pageSize: '8' };
    if (regionId !== undefined) params['regionId'] = String(regionId);
    return this.http.get<{ total: number; items: any[] }>(
      `/api/admin/destinations`,
      { params },
    ).pipe(map(r => r.items.map(d => ({
      id: d.id,
      name: d.name,
      city: d.city ?? null,
      regionId: d.regionId ?? null,
      countryId: d.countryId ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
    }))));
  }

  createCategory(name: string): Observable<CategoryOption> {
    return this.http.post<CategoryOption>(`${this.base}/categories`, { name });
  }

  createFilterDefinition(categoryId: number, filterLabel: string, filterType: string): Observable<FilterDefinition> {
    return this.http.post<FilterDefinition>('/api/admin/filter-definitions', {
      entityType: 'activity', typeId: categoryId, filterLabel, filterType,
    });
  }

  getActivityInterests(id: string): Observable<InterestTagOption[]> {
    return this.http.get<InterestTagOption[]>(`/api/admin/interest-tags/activity/${id}`);
  }

  setActivityInterests(id: string, tagIds: number[]): Observable<void> {
    return this.http.put<void>(`/api/admin/interest-tags/activity/${id}`, { tagIds });
  }

  getAllInterestTags(): Observable<InterestTagOption[]> {
    return this.http.get<InterestTagOption[]>('/api/interest-tags');
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

  restoreActivity(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/restore`, {});
  }
}
