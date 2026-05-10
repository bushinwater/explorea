export type ActivityStatus = 'active' | 'pending' | 'inactive' | 'rejected';

export type ActivityCategory =
  | 'hiking'
  | 'water_sports'
  | 'culture'
  | 'gastronomy'
  | 'wellness'
  | 'adventure';

export type ActivityDifficulty = 'easy' | 'medium' | 'hard';

export interface ActivityRow {
  id: string;
  name: string;
  city: string;
  region: string;
  category: ActivityCategory;
  status: ActivityStatus;
  difficulty: ActivityDifficulty;
  thumbnailUrl: string | null;
  views: number;
  rating: number;
  reviewCount: number;
  durationMinutes: number;
  price: number | null;
  maxCapacity: number | null;
  shortDescription: string;
  lastUpdatedAt: string;
}

export interface ActivityStats {
  totalActivities: number;
  totalActivitiesTrend: string;
  pendingCount: number;
  pendingHint: string;
  averageRating: number;
  averageRatingHint: string;
  monthlyViews: number;
  monthlyViewsTrend: string;
}

export interface ActivityFilters {
  search: string;
  category: ActivityCategory | 'all';
  status: ActivityStatus | 'all';
  difficulty: ActivityDifficulty | 'all';
  minRating: number | 'all';
  region: string | 'all';
  page: number;
  pageSize: number;
}

export interface ActivityPagedResponse {
  items: ActivityRow[];
  total: number;
}
