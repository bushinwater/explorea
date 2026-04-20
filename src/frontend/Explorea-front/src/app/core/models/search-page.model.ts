import { SearchItem } from './search.model';

// ─── Query types ──────────────────────────────────────────────────────────────

export interface SearchFilters {
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  openNow?: boolean;
  cityIds?: number[];
  regionsIds?: number[];
  placeTypeIds?: number[];
  activityCategoryIds?: number[];
  eventTypeIds?: number[];
  radiusKm?: number;
}

export interface SearchPageAllQuery extends SearchFilters {
  query?: string;
  sortBy?: string;
  userLat?: number;
  userLng?: number;
}

export interface SearchPageListQuery extends SearchPageAllQuery {
  tab: string;
  page?: number;
  pageSize?: number;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface SearchPageSummary {
  query?: string;
  totalMatched: number;
}

export interface SearchPageSection {
  key: string;
  title: string;
  entityType: string;
  items: SearchItem[];
}

export interface SearchPageAllResponse {
  tab: string;
  summary: SearchPageSummary;
  sections: SearchPageSection[];
}

export interface SearchPagePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchPageSort {
  selected?: string;
  available: string[];
}

export interface SearchPageAppliedFilters {
  regionsIds?: number[];
  cityIds?: number[];
  destinationIds?: string[];
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  openNow?: boolean;
  placeTypeIds?: number[];
  activityCategoryIds?: number[];
  eventTypeIds?: number[];
}

export interface SearchPageListResponse {
  tab: string;
  summary: SearchPageSummary;
  items: SearchItem[];
  pagination: SearchPagePagination;
  sort: SearchPageSort;
  appliedFilters: SearchPageAppliedFilters;
}
