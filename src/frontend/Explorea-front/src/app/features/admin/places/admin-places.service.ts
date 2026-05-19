import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreatePlaceDto,
  PlaceDetail,
  PlaceFilters,
  PlaceImage,
  PlacePagedResponse,
  PlaceStats,
  PlaceTypeOption,
  RegionOption,
  UpdatePlaceDto,
} from './admin-places.models';

@Injectable({ providedIn: 'root' })
export class AdminPlacesService {
  private readonly base = '/api/admin/places';

  constructor(private readonly http: HttpClient) {}

  getPlaces(filters: PlaceFilters): Observable<PlacePagedResponse> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.typeId !== 'all') {
      params = params.set('typeId', filters.typeId);
    }
    if (filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.regionId !== 'all') {
      params = params.set('region', filters.regionId);
    }
    if (filters.minRating !== null) {
      params = params.set('minRating', filters.minRating);
    }

    return this.http.get<PlacePagedResponse>(this.base, { params });
  }

  getStats(): Observable<PlaceStats> {
    return this.http.get<PlaceStats>(`${this.base}/stats`);
  }

  getTypes(): Observable<PlaceTypeOption[]> {
    return this.http.get<PlaceTypeOption[]>('/api/admin/place-types');
  }

  getRegions(): Observable<RegionOption[]> {
    return this.http.get<RegionOption[]>('/api/admin/destinations/regions');
  }

  getById(id: string): Observable<PlaceDetail> {
    return this.http.get<PlaceDetail>(`${this.base}/${id}`);
  }

  create(dto: CreatePlaceDto): Observable<PlaceDetail> {
    return this.http.post<PlaceDetail>(this.base, dto);
  }

  update(id: string, dto: UpdatePlaceDto): Observable<PlaceDetail> {
    return this.http.put<PlaceDetail>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  uploadImage(placeId: string, file: File): Observable<PlaceImage> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<PlaceImage>(`${this.base}/${placeId}/images`, formData);
  }

  setHeroImage(placeId: string, imageId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${placeId}/images/${imageId}/hero`, {});
  }

  deleteImage(placeId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${placeId}/images/${imageId}`);
  }
}
