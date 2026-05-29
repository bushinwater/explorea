import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExploreMarker {
  entityType: string;
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  previewImageUrl: string | null;
  avgRating: number | null;
  subtitle: string | null;
  categoryId: number | null;
  price: number | null;
  startDatetime: string | null;
}

export interface ExploreMapResult {
  total: number;
  markers: ExploreMarker[];
}

export interface ExploreParams {
  lat?: number;
  lng?: number;
  radius: number;
  limit: number;
  minRating?: number;
  openNow?: boolean;
  placeTypeIds?: number[];
  activityCategoryIds?: number[];
  eventTypeIds?: number[];
  destinationTypeIds?: number[];
  minPrice?: number;
  maxPrice?: number;
  extraFilters?: Record<string, string>;
  regionId?: number;
}

@Injectable({ providedIn: 'root' })
export class ExploreService {
  private api = '/api/explore';

  constructor(private http: HttpClient) {}

  getMarkerBySlug(entityType: string, slug: string): Observable<ExploreMarker> {
    return this.http.get<ExploreMarker>(`${this.api}/marker`, {
      params: { type: entityType, slug },
    });
  }

  getMapMarkers(params: ExploreParams): Observable<ExploreMapResult> {
    let httpParams = new HttpParams()
      .set('radius', params.radius)
      .set('limit', params.limit)
      .set('type', 'all');

    if (params.lat !== undefined) httpParams = httpParams.set('lat', params.lat);
    if (params.lng !== undefined) httpParams = httpParams.set('lng', params.lng);
    if (params.minRating !== undefined) httpParams = httpParams.set('minRating', params.minRating);
    if (params.openNow) httpParams = httpParams.set('openNow', true);
    if (params.minPrice !== undefined) httpParams = httpParams.set('minPrice', params.minPrice);
    if (params.maxPrice !== undefined) httpParams = httpParams.set('maxPrice', params.maxPrice);

    for (const id of params.placeTypeIds ?? [])
      httpParams = httpParams.append('placeTypeIds', id);
    for (const id of params.activityCategoryIds ?? [])
      httpParams = httpParams.append('activityCategoryIds', id);
    for (const id of params.eventTypeIds ?? [])
      httpParams = httpParams.append('eventTypeIds', id);
    for (const id of params.destinationTypeIds ?? [])
      httpParams = httpParams.append('destinationTypeIds', id);

    const ef = params.extraFilters ?? {};
    for (const [key, value] of Object.entries(ef))
      httpParams = httpParams.append('extraFilters', `${key}:${value}`);

    if (params.regionId !== undefined) httpParams = httpParams.set('regionId', params.regionId);

    return this.http.get<ExploreMapResult>(`${this.api}/map`, { params: httpParams });
  }
}
