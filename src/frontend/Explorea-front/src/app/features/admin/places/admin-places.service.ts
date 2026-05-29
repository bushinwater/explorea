import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  AmenityOption,
  CountryOption,
  CreatePlaceDto,
  DestinationOption,
  InterestTagOption,
  PlaceDetail,
  PlaceFilters,
  PlaceImage,
  PlacePagedResponse,
  PlaceReview,
  PlaceStats,
  PlaceTypeOption,
  RegionOption,
  UpdatePlaceDto,
} from './admin-places.models';
import { FilterDefinition } from '../../../core/services/lookup.service';

@Injectable({ providedIn: 'root' })
export class AdminPlacesService {
  private readonly base = '/api/admin/places';

  constructor(private readonly http: HttpClient) {}

  getPlaces(filters: PlaceFilters): Observable<PlacePagedResponse> {
    return this.getPlaceList(this.base, filters);
  }

  getDeletedPlaces(filters: PlaceFilters): Observable<PlacePagedResponse> {
    return this.getPlaceList(`${this.base}/deleted`, filters, true);
  }

  private getPlaceList(
    url: string,
    filters: PlaceFilters,
    deletedOnly = false,
  ): Observable<PlacePagedResponse> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.typeId !== 'all') {
      params = params.set('typeId', filters.typeId);
    }
    if (!deletedOnly && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.regionId !== 'all') {
      params = params.set('region', filters.regionId);
    }
    if (!deletedOnly && filters.minRating !== null) {
      params = params.set('minRating', filters.minRating);
    }
    if (!deletedOnly && filters.amenityId !== null) {
      params = params.set('amenityId', filters.amenityId);
    }

    if (!deletedOnly && filters.sortBy !== 'none') {
      params = params.set('sortBy', filters.sortBy);
    }

    return this.http.get<PlacePagedResponse>(url, { params });
  }

  getStats(): Observable<PlaceStats> {
    return this.http.get<PlaceStats>(`${this.base}/stats`);
  }

  getTypes(): Observable<PlaceTypeOption[]> {
    return this.http.get<PlaceTypeOption[]>('/api/admin/place-types');
  }

  getAmenities(typeId?: number): Observable<AmenityOption[]> {
    let params = new HttpParams();
    if (typeId !== undefined) params = params.set('typeId', typeId);
    return this.http.get<AmenityOption[]>(`${this.base}/amenities`, { params });
  }

  getRegions(): Observable<RegionOption[]> {
    return this.http.get<any[]>('/api/admin/destinations/regions').pipe(
      map(items => items.map(r => ({ id: r.id, name: r.name, countryId: r.countryId ?? null }))),
    );
  }

  getCountries(): Observable<CountryOption[]> {
    return this.http.get<CountryOption[]>('/api/admin/destinations/countries');
  }

  searchDestinations(query: string, regionId?: number): Observable<DestinationOption[]> {
    const params: Record<string, string> = { search: query, page: '1', pageSize: '8' };
    if (regionId !== undefined) params['regionId'] = String(regionId);
    return this.http.get<{ total: number; items: any[] }>('/api/admin/destinations', { params }).pipe(
      map(r => r.items.map(d => ({
        id: d.id,
        name: d.name,
        city: d.city ?? null,
        cityId: d.cityId ?? null,
        regionId: d.regionId ?? null,
        countryId: d.countryId ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
      }))),
    );
  }

  getDestinationById(id: string): Observable<{ id: string; name: string; latitude: number | null; longitude: number | null; regionId: number | null; countryId: number | null }> {
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

  createType(name: string): Observable<PlaceTypeOption> {
    return this.http.post<PlaceTypeOption>('/api/admin/place-types', { name });
  }

  getFilterDefinitions(typeId: number): Observable<FilterDefinition[]> {
    const params = new HttpParams().set('entityType', 'place').set('typeId', typeId);
    return this.http.get<FilterDefinition[]>('/api/filter-definitions', { params });
  }

  createFilterDefinition(typeId: number, filterKey: string, filterLabel: string, filterType: string): Observable<FilterDefinition> {
    return this.http.post<FilterDefinition>('/api/admin/filter-definitions', {
      entityType: 'place', typeId, filterKey, filterLabel, filterType,
    });
  }

  getAllInterestTags(): Observable<InterestTagOption[]> {
    return this.http.get<InterestTagOption[]>('/api/interest-tags');
  }

  getPlaceInterests(id: string): Observable<InterestTagOption[]> {
    return this.http.get<InterestTagOption[]>(`/api/admin/interest-tags/place/${id}`);
  }

  setPlaceInterests(id: string, tagIds: number[]): Observable<void> {
    return this.http.put<void>(`/api/admin/interest-tags/place/${id}`, { tagIds });
  }

  getPlaceReviews(placeId: string): Observable<PlaceReview[]> {
    return this.http.get<PlaceReview[]>(`${this.base}/${placeId}/reviews`);
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

  restorePlace(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/restore`, {});
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
