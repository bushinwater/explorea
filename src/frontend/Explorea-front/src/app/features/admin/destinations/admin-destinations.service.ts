import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FilterDefinition } from '../../../core/services/lookup.service';
import {
  CountryOption,
  DestinationCategory,
  DestinationDetail,
  DestinationFilters,
  DestinationImage,
  DestinationPagedResponse,
  DestinationRow,
  DestinationStats,
  DestinationStatus,
  InterestTagOption,
  RegionOption,
  ReviewItem,
  TypeOption,
} from './admin-destinations.models';

interface ApiDestinationResponse {
  total: number;
  items: ApiDestinationItem[];
}

interface ApiDestinationItem {
  id: string;
  name: string;
  slug: string;
  previewImageUrl: string | null;
  region: string | null;
  regionId: number | null;
  views: number;
  status: string;
  typeId: number | null;
  typeName: string | null;
  avgRating: number;
  visibility: string;
  city: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

interface ApiDestinationStats {
  totalViews: number;
  inactiveCount: number;
  addedLast30Days: number;
  mostPopularName: string;
  mostPopularViews: number;
  topDestinations?: Array<{ name: string; views: number }>;
}

@Injectable({ providedIn: 'root' })
export class AdminDestinationsService {
  private readonly http = inject(HttpClient);

  getStats(): Observable<DestinationStats> {
    return this.http.get<ApiDestinationStats>('/api/admin/destinations/stats').pipe(
      map((stats) => ({
        ...stats,
        topDestinations: stats.topDestinations ?? [],
      })),
    );
  }

  getDestinations(filters: DestinationFilters): Observable<DestinationPagedResponse> {
    return this.getDestinationList('/api/admin/destinations', filters);
  }

  getDeletedDestinations(filters: DestinationFilters): Observable<DestinationPagedResponse> {
    return this.getDestinationList('/api/admin/destinations/deleted', filters, true);
  }

  private getDestinationList(
    url: string,
    filters: DestinationFilters,
    deletedOnly = false,
  ): Observable<DestinationPagedResponse> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }

    const regionId = Number(filters.region);
    if (filters.region !== 'all' && Number.isFinite(regionId)) {
      params = params.set('regionId', regionId);
    }

    const typeId = Number(filters.category);
    if (filters.category !== 'all' && Number.isFinite(typeId)) {
      params = params.set('typeId', typeId);
    }

    if (!deletedOnly && filters.minRating !== null) {
      params = params.set('minRating', filters.minRating);
    }

    if (!deletedOnly) {
      for (const [key, value] of Object.entries(filters.extraFilters)) {
        params = params.append('extraFilters', `${key}:${value}`);
      }
    }

    if (!deletedOnly && filters.status !== 'all') {
      params = params.set('visibility', filters.status);
    }

    return this.http.get<ApiDestinationResponse>(url, { params }).pipe(
      map((response) => ({
        total: response.total,
        items: response.items.map((item) => this.mapToRow(item)),
      })),
    );
  }

  getRegions(): Observable<RegionOption[]> {
    return this.http.get<RegionOption[]>('/api/admin/destinations/regions');
  }

  getCountries(): Observable<CountryOption[]> {
    return this.http.get<CountryOption[]>('/api/admin/destinations/countries');
  }

  getTypes(): Observable<TypeOption[]> {
    return this.http.get<TypeOption[]>('/api/admin/destinations/types');
  }

  createDestination(dto: {
    name: string; slug: string; description: string;
    latitude: number; longitude: number; visibility: string;
    typeId?: number | null; regionId?: number | null; countryId?: number | null;
    extraFilters?: Record<string, string>;
  }): Observable<DestinationRow> {
    return this.http.post<ApiDestinationItem>('/api/admin/destinations', dto).pipe(
      map((item) => this.mapToRow(item)),
    );
  }

  createFilterDefinition(typeId: number, filterKey: string, filterLabel: string, filterType: string): Observable<FilterDefinition> {
    return this.http.post<FilterDefinition>('/api/admin/filter-definitions', {
      entityType: 'destination', typeId, filterKey, filterLabel, filterType,
    });
  }

  createType(name: string): Observable<{ id: number; name: string }> {
    return this.http.post<{ id: number; name: string }>(
      '/api/admin/destinations/types', { name }
    );
  }

  getDestinationById(id: string): Observable<DestinationDetail> {
    return this.http.get<ApiDestinationItem>(`/api/admin/destinations/${id}`).pipe(
      map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: (item as any).description ?? null,
        latitude: (item as any).latitude ?? null,
        longitude: (item as any).longitude ?? null,
        visibility: item.visibility,
        previewImageUrl: item.previewImageUrl ?? null,
        typeId: item.typeId ?? null,
        regionId: item.regionId ?? null,
        countryId: (item as any).countryId ?? null,
        images: ((item as any).images ?? []).map((img: any) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          sortOrder: img.sortOrder,
        })),
        extraFilters: (item as any).extraFilters ?? {},
      })),
    );
  }

  setPreviewImage(destinationId: string, imageId: string): Observable<{ previewImageUrl: string }> {
    return this.http.put<{ previewImageUrl: string }>(
      `/api/admin/destinations/${destinationId}/images/${imageId}/preview`, {}
    );
  }

  updateDestination(id: string, dto: Partial<{ name: string; description: string; latitude: number; longitude: number; visibility: string; typeId: number | null; clearTypeId: boolean; regionId: number | null; clearRegionId: boolean; countryId: number | null; clearCountryId: boolean; extraFilters: Record<string, string> }>): Observable<DestinationRow> {
    return this.http.put<ApiDestinationItem>(`/api/admin/destinations/${id}`, dto).pipe(
      map((item) => this.mapToRow(item)),
    );
  }

  addImage(destinationId: string, file: File): Observable<DestinationImage> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ id: string; imageUrl: string; sortOrder: number }>(
      `/api/admin/destinations/${destinationId}/images`, form
    );
  }

  deleteImage(destinationId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/destinations/${destinationId}/images/${imageId}`);
  }

  deleteDestination(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/destinations/${id}`);
  }

  getDestinationInterests(id: string): Observable<InterestTagOption[]> {
    return this.http.get<InterestTagOption[]>(`/api/admin/interest-tags/destination/${id}`);
  }

  getDestinationReviews(id: string): Observable<ReviewItem[]> {
    return this.http.get<ReviewItem[]>(`/api/admin/destinations/${id}/reviews`);
  }

  setDestinationInterests(id: string, tagIds: number[]): Observable<void> {
    return this.http.put<void>(`/api/admin/interest-tags/destination/${id}`, { tagIds });
  }

  getAllInterestTags(): Observable<InterestTagOption[]> {
    return this.http.get<InterestTagOption[]>('/api/interest-tags');
  }

  private mapToRow(item: ApiDestinationItem): DestinationRow {
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      city: item.city ?? item.country ?? 'Nepoznato',
      region: item.region ?? 'Bez regije',
      regionId: item.regionId,
      category: this.mapCategory(item.typeName),
      typeId: item.typeId,
      typeName: item.typeName,
      status: this.mapStatus(item.status || item.visibility),
      thumbnailUrl: item.previewImageUrl,
      views: item.views,
      avgRating: item.avgRating,
      lastUpdatedAt: item.updatedAt,
      deletedAt: item.deletedAt ?? null,
    };
  }

  private mapStatus(value: string): DestinationStatus {
    const normalized = value.trim().toLowerCase();
    if (['active', 'pending', 'inactive', 'rejected'].includes(normalized)) {
      return normalized as DestinationStatus;
    }

    const map: Record<string, DestinationStatus> = {
      published: 'active',
      draft: 'pending',
      archived: 'inactive',
    };

    return map[normalized] ?? 'inactive';
  }

  private mapCategory(typeName: string | null): DestinationCategory {
    const normalized = typeName?.trim().toLowerCase() ?? '';

    if (normalized.includes('kultur') || normalized.includes('culture')) return 'cultural';
    if (normalized.includes('priro') || normalized.includes('nature')) return 'nature';
    if (normalized.includes('gastro') || normalized.includes('food')) return 'gastronomy';
    if (normalized.includes('avant') || normalized.includes('adventure')) return 'adventure';
    if (normalized.includes('wellness') || normalized.includes('spa')) return 'wellness';
    if (normalized.includes('istor') || normalized.includes('history')) return 'historical';

    return 'cultural';
  }
}
