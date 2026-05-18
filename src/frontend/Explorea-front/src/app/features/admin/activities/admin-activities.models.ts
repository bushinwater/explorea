export type ActivityStatus = 'active' | 'pending' | 'inactive' | 'rejected';

export type ActivityDifficulty = 'easy' | 'medium' | 'hard';

export interface ActivityRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: number;
  category: string;
  cityId: number | null;
  city: string | null;
  regionId: number | null;
  region: string | null;
  price: number | null;
  durationMinutes: number | null;
  durationGroup: string | null;
  difficultyLevel: string | null;
  distanceKm: number | null;
  startPoint: string | null;
  avgRating: number;
  popularity: number;
  isFeatured: boolean;
  isActive: boolean;
  previewImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityReview {
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ActivityDetail extends ActivityRow {
  imageUrls: string[];
  inclusions: string[];
  reviews: ActivityReview[];
  cityName: string | null;
  regionId: number | null;
  regionName: string | null;
  categoryName: string;
  seasonName: string | null;
  destinationId: string | null;
  latitude: number | null;
  longitude: number | null;
  organizerWebsite: string | null;
}

export interface ActivityStats {
  totalActivities: number;
  mostPopularName: string;
  mostPopularViews: number;
  inactiveCount: number;
  newestName: string;
  newestCreatedAt: string;
}

export interface ActivityFilters {
  search: string;
  categoryId: number | 'all';
  status: ActivityStatus | 'all';
  difficulty: ActivityDifficulty | 'all';
  minRating: number | 'all';
  regionId: number | 'all';
  page: number;
  pageSize: number;
}

export interface ActivityPagedResponse {
  items: ActivityRow[];
  total: number;
}

export interface CategoryOption {
  id: number;
  name: string;
}

export interface RegionOption {
  id: number;
  name: string;
}

export interface CreateActivityDto {
  name: string;
  slug: string;
  categoryId: number;
  description?: string;
  price?: number;
  durationMinutes?: number;
  difficultyLevel?: string;
  cityId?: number;
  destinationId?: string;
  inclusions?: string[];
}

export interface UpdateActivityDto {
  name?: string;
  slug?: string;
  categoryId?: number;
  description?: string;
  price?: number;
  durationMinutes?: number;
  difficultyLevel?: string;
  cityId?: number;
  destinationId?: string;
  isActive?: boolean;
}

export interface CityOption {
  id: number;
  name: string;
}
