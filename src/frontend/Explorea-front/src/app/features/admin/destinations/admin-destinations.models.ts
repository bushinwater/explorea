export type DestinationStatus = 'active' | 'pending' | 'inactive' | 'rejected';

export interface DependencyItem {
  id: string;
  name: string;
  previewImageUrl: string | null;
  typeLabel: string | null;
  city: string | null;
  avgRating: number;
  entityType: string;
  startDate: string | null;
  viaPlaceName: string | null;
}

export interface DestinationDependenciesResponse {
  eventCount: number;
  placeCount: number;
  activityCount: number;
  items: DependencyItem[];
  total: number;
}

export interface ReviewItem {
  id?: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  imageUrls?: string[];
}

export interface DestinationImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface InterestTagOption {
  id: number;
  name: string;
  icon: string | null;
  isAssigned?: boolean;
}

export interface DestinationDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: string;
  previewImageUrl: string | null;
  typeId: number | null;
  regionId: number | null;
  countryId: number | null;
  images: DestinationImage[];
  extraFilters: Record<string, string>;
}

export type DestinationCategory =
  | 'cultural'
  | 'nature'
  | 'gastronomy'
  | 'adventure'
  | 'wellness'
  | 'historical';

export interface DestinationRow {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  city: string;
  region: string;
  regionId?: number | null;
  category: DestinationCategory;
  typeId?: number | null;
  typeName?: string | null;
  status: DestinationStatus;
  thumbnailUrl: string | null;
  views: number;
  avgRating?: number;
  lastUpdatedAt: string;
  deletedAt?: string | null;
}

export interface TopDestination {
  name: string;
  views: number;
}

export interface DestinationStats {
  totalViews: number;
  inactiveCount: number;
  addedLast30Days: number;
  mostPopularName: string;
  mostPopularViews: number;
  topDestinations: TopDestination[];
}

export interface DestinationFilters {
  search: string;
  category: string | 'all';
  status: DestinationStatus | 'all';
  region: string | 'all';
  minRating: number | null;
  extraFilters: Record<string, string>;
  sortBy: 'none' | 'updatedAt_desc' | 'updatedAt_asc';
  page: number;
  pageSize: number;
}

export interface DestinationPagedResponse {
  items: DestinationRow[];
  total: number;
}

export interface RegionOption {
  id: number;
  name: string;
  countryId?: number | null;
}

export interface CountryOption {
  id: number;
  name: string;
  code: string;
}

export interface TypeOption {
  id: number;
  name: string;
}
