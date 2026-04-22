import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

export interface LookupItem {
  id: number;
  name: string;
}

export interface FilterOption {
  optionValue: string;
  optionLabel: string;
}

export interface FilterDefinition {
  id: number;
  filterKey: string;
  filterLabel: string;
  filterType: 'boolean' | 'range_int' | 'range_decimal' | 'select' | 'multi_select';
  sortOrder: number;
  options: FilterOption[];
}

@Injectable({ providedIn: 'root' })
export class LookupService {
  constructor(private http: HttpClient) {}

  getPlaceTypes(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>('/api/place-types').pipe(shareReplay(1));
  }

  getEventTypes(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>('/api/event-types').pipe(shareReplay(1));
  }

  getActivityCategories(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>('/api/activity-categories').pipe(shareReplay(1));
  }

  getCities(regionId?: number): Observable<LookupItem[]> {
    const params: Record<string, string> = {};
    if (regionId != null) params['regionId'] = String(regionId);
    return this.http.get<LookupItem[]>('/api/cities', { params }).pipe(shareReplay(1));
  }

  getDestinationTypes(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>('/api/destination-types').pipe(shareReplay(1));
  }

  getFilterDefinitions(entityType: string, typeId: number): Observable<FilterDefinition[]> {
    return this.http.get<FilterDefinition[]>('/api/filter-definitions', {
      params: { entityType, typeId: String(typeId) },
    });
  }
}
