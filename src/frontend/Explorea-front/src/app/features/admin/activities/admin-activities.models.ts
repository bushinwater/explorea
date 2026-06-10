export interface InterestTagOption {
  id: number;
  name: string;
  icon: string | null;
  isAssigned?: boolean;
}

export type ActivityStatus = 'active' | 'inactive';

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
  destination: string | null;
  price: number | null;
  durationMinutes: number | null;
  durationGroup: string | null;
  difficultyLevel: string | null;
  distanceKm: number | null;
  startPoint: string | null;
  avgRating: number;
  popularity: number;
  views: number;
  isFeatured: boolean;
  isActive: boolean;
  previewImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ActivityReview {
  id?: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  imageUrls?: string[];
}

export interface ActivityImageItem {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ActivityDetail extends ActivityRow {
  images: ActivityImageItem[];
  inclusions: string[];
  reviews: ActivityReview[];
  cityName: string | null;
  regionId: number | null;
  regionName: string | null;
  countryId: number | null;
  categoryName: string;
  seasonName: string | null;
  destinationId: string | null;
  latitude: number | null;
  longitude: number | null;
  organizerWebsite: string | null;
  extraFilters?: Record<string, string>;
}

export interface ActivityStats {
  totalActivities: number;
  activeCount: number;
  deletedCount: number;
  mostPopularName: string;
  mostPopularViews: number;
  inactiveCount: number;
  newestName: string;
  newestCreatedAt: string;
}

export interface ActivityFilters {
  search: string;
  ids?: string[];
  categoryId: number | 'all';
  status: ActivityStatus | 'all';
  difficulty: ActivityDifficulty | 'all';
  minRating: number | 'all';
  regionId: number | 'all';
  extraFilters: Record<string, string>;
  sortBy: 'none' | 'updatedAt_desc' | 'updatedAt_asc';
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
  countryId?: number | null;
}

export interface CountryOption {
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
  startPoint?: string | null;
  cityId?: number;
  regionId?: number;
  countryId?: number | null;
  destinationId?: string;
  latitude?: number;
  longitude?: number;
  inclusions?: string[];
  extraFilters?: Record<string, string>;
  organizerWebsite?: string | null;
}

export interface UpdateActivityDto {
  name?: string;
  slug?: string;
  categoryId?: number;
  description?: string;
  price?: number;
  durationMinutes?: number;
  difficultyLevel?: string;
  startPoint?: string | null;
  cityId?: number;
  destinationId?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  extraFilters?: Record<string, string>;
  inclusions?: string[];
  organizerWebsite?: string | null;
  countryId?: number | null;
}

export interface CityOption {
  id: number;
  name: string;
}

export interface DestinationOption {
  id: string;
  name: string;
  city: string | null;
  regionId?: number | null;
  countryId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ActivityFilterOptions {
  difficulties: string[];
  categories: CategoryOption[];
  managedRegion: { id: number; name: string } | null;
}
