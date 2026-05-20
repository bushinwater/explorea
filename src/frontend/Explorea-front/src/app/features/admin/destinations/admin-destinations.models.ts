export type DestinationStatus = 'active' | 'pending' | 'inactive' | 'rejected';

export interface DestinationImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface DestinationDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility: string;
  previewImageUrl: string | null;
  typeId: number | null;
  regionId: number | null;
  images: DestinationImage[];
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
}

export interface TypeOption {
  id: number;
  name: string;
}
