import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SearchPageAllQuery,
  SearchPageAllResponse,
  SearchPageListQuery,
  SearchPageListResponse,
} from '../models/search-page.model';

@Injectable({ providedIn: 'root' })
export class SearchPageService {
  private readonly api = '/api/search-page';

  constructor(private http: HttpClient) {}

  getAll(query: SearchPageAllQuery = {}): Observable<SearchPageAllResponse> {
    return this.http.get<SearchPageAllResponse>(`${this.api}/all`, {
      params: this.buildParams(query),
    });
  }

  getList(query: SearchPageListQuery): Observable<SearchPageListResponse> {
    return this.http.get<SearchPageListResponse>(`${this.api}/list`, {
      params: this.buildParams(query),
    });
  }

  private buildParams(q: SearchPageListQuery | SearchPageAllQuery): HttpParams {
    let p = new HttpParams();
    const set = (key: string, val: string | number | boolean) =>
      { p = p.set(key, String(val)); };
    const append = (key: string, val: string | number) =>
      { p = p.append(key, String(val)); };

    if ('tab' in q && q.tab)         set('tab',      q.tab);
    if ('page' in q && q.page)       set('page',     q.page!);
    if ('pageSize' in q && q.pageSize) set('pageSize', q.pageSize!);
    if (q.query)                     set('query',    q.query);
    if (q.sortBy)                    set('sortBy',   q.sortBy);
    if (q.userLat != null)           set('userLat',  q.userLat);
    if (q.userLng != null)           set('userLng',  q.userLng);
    if (q.minRating != null)         set('minRating', q.minRating);
    if (q.minPrice  != null)         set('minPrice',  q.minPrice);
    if (q.maxPrice  != null)         set('maxPrice',  q.maxPrice);
    if (q.openNow   != null)         set('openNow',   q.openNow);
    if (q.radiusKm  != null)         set('radiusKm',  q.radiusKm);

    (q.cityIds            ?? []).forEach(id => append('cityIds',             id));
    (q.regionsIds         ?? []).forEach(id => append('regionsIds',          id));
    (q.placeTypeIds       ?? []).forEach(id => append('placeTypeIds',        id));
    (q.activityCategoryIds ?? []).forEach(id => append('activityCategoryIds', id));
    (q.eventTypeIds       ?? []).forEach(id => append('eventTypeIds',        id));
    (q.destinationTypeIds ?? []).forEach(id => append('destinationTypeIds',  id));

    if (q.extraFilters) {
      Object.entries(q.extraFilters).forEach(([key, val]) => {
        p = p.append('extraFilters', `${key}:${val}`);
      });
    }

    return p;
  }
}
