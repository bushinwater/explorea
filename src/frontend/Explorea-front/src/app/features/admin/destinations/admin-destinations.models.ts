export type DestinationStatus = 'active' | 'pending' | 'inactive' | 'rejected';

export type DestinationCategory =
  | 'cultural'
  | 'nature'
  | 'gastronomy'
  | 'adventure'
  | 'wellness'
  | 'historical';

export interface DestinationRow {
  id: string;
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
  sparklineData: number[];
  avgRating?: number;
  lastUpdatedAt: string;
}

export interface TopDestination {
  name: string;
  views: number;
}

export interface DestinationStats {
  totalViews: number;
  totalViewsTrend?: string;
  inactiveCount: number;
  inactiveTrend?: string;
  pendingCount?: number;
  pendingHint?: string;
  addedLast30Days: number | number[];
  mostPopularName: string;
  mostPopularViews: number;
  topDestinations?: TopDestination[];
}

export interface DestinationFilters {
  search: string;
  category: string | 'all';
  status: DestinationStatus | 'all';
  region: string | 'all';
  minRating: number | null;
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
