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
  category: DestinationCategory;
  status: DestinationStatus;
  thumbnailUrl: string | null;
  views: number;
  sparklineData: number[];
  lastUpdatedAt: string;
}

export interface DestinationStats {
  totalViews: number;
  totalViewsTrend: string;
  inactiveCount: number;
  inactiveTrend: string;
  pendingCount: number;
  pendingHint: string;
  addedLast30Days: number[];
}

export interface DestinationFilters {
  search: string;
  category: DestinationCategory | 'all';
  status: DestinationStatus | 'all';
  region: string | 'all';
  page: number;
  pageSize: number;
}

export interface DestinationPagedResponse {
  items: DestinationRow[];
  total: number;
}
