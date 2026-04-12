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

    return this.http.get<ExploreMapResult>(`${this.api}/map`, { params: httpParams });
  }
}
