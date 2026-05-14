import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  DestinationCategory,
  DestinationFilters,
  DestinationPagedResponse,
  DestinationRow,
  DestinationStats,
  DestinationStatus,
  RegionOption,
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
}

@Injectable({ providedIn: 'root' })
export class AdminDestinationsService {
  private readonly http = inject(HttpClient);

  getStats(): Observable<DestinationStats> {
    return this.http.get<DestinationStats>('/api/admin/destinations/stats');
  }

  getDestinations(filters: DestinationFilters): Observable<DestinationPagedResponse> {
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

    if (filters.minRating !== null) {
      params = params.set('minRating', filters.minRating);
    }

    if (filters.status !== 'all') {
      params = params.set('visibility', filters.status);
    }

    return this.http.get<ApiDestinationResponse>('/api/admin/destinations', { params }).pipe(
      map((response) => ({
        total: response.total,
        items: response.items.map((item) => this.mapToRow(item)),
      })),
    );
  }

  getRegions(): Observable<RegionOption[]> {
    return this.http.get<RegionOption[]>('/api/admin/destinations/regions');
  }

  getTypes(): Observable<TypeOption[]> {
    return this.http.get<TypeOption[]>('/api/admin/destinations/types');
  }

  deleteDestination(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/destinations/${id}`);
  }

  private mapToRow(item: ApiDestinationItem): DestinationRow {
    return {
      id: item.id,
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
      sparklineData: [],
      avgRating: item.avgRating,
      lastUpdatedAt: item.updatedAt,
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
