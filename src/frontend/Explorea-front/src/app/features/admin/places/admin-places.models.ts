export type PlaceStatus = 'approved' | 'pending' | 'inactive' | 'rejected';

export interface PlaceDependencyItem {
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

export interface PlaceDependenciesResponse {
  eventCount: number;
  placeCount: number;
  activityCount: number;
  items: PlaceDependencyItem[];
  total: number;
}

export interface InterestTagOption {
  id: number;
  name: string;
  icon: string | null;
  isAssigned?: boolean;
}

export interface CountryOption {
  id: number;
  name: string;
}

export interface DestinationOption {
  id: string;
  name: string;
  city: string | null;
  cityId?: number | null;
  regionId?: number | null;
  countryId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PlaceReview {
  id?: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  imageUrls?: string[];
}

export interface PlaceImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
}

export interface PlaceRow {
  id: string;
  name: string;
  slug: string;
  previewImageUrl: string | null;
  typeId: number | null;
  type: string | null;
  city: string | null;
  region: string | null;
  destination: string | null;
  avgRating: number;
  isFeatured: boolean;
  hasRecentActivity: boolean;
  address: string | null;
  status: PlaceStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PlaceWorkingHourInterval {
  id: string;
  opensAt: string;
  closesAt: string;
}

export interface PlaceWorkingDay {
  id: string;
  dayOfWeek: number;
  isClosed: boolean;
  note: string | null;
  intervals: PlaceWorkingHourInterval[];
}

export interface PlaceAmenity {
  id: number;
  name: string;
}

export interface PlaceDetail {
  id: string;
  destinationId: string | null;
  cityId: number | null;
  countryId: number | null;
  typeId: number | null;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  priceRange: string | null;
  pricePerNight: number | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  avgRating: number;
  views: number;
  isFeatured: boolean;
  status: PlaceStatus;
  type: string | null;
  city: string | null;
  region: string | null;
  destination: string | null;
  country: string | null;
  createdBy: string | null;
  images: PlaceImage[];
  amenities: PlaceAmenity[];
  workingDays: PlaceWorkingDay[];
  documents: OwnerSubmissionDocument[];
  extraFilters?: Record<string, string>;
  reviews?: PlaceReview[];
  createdAt: string;
  updatedAt: string;
}

export interface TopPlace {
  id: string;
  name: string;
  avgRating: number;
  reviewCount: number;
}

export interface PlaceStats {
  totalCount: number;
  activeCount: number;
  pendingCount: number;
  inactiveCount: number;
  addedLast30Days: number;
  topPlaces: TopPlace[];
}

export interface PlaceFilters {
  search: string;
  typeId: number | 'all';
  status: PlaceStatus | 'all';
  regionId: number | 'all';
  minRating: number | null;
  amenityId: number | null;
  sortBy: 'none' | 'updatedAt_desc' | 'updatedAt_asc';
  page: number;
  pageSize: number;
}

export interface AmenityOption {
  id: number;
  name: string;
}

export interface PlacePagedResponse {
  items: PlaceRow[];
  total: number;
}

export interface PlaceTypeOption {
  id: number;
  name: string;
}

export interface RegionOption {
  id: number;
  name: string;
  countryId?: number | null;
}

export interface CityOption {
  id: number;
  name: string;
}

export interface CreatePlaceDto {
  name: string;
  slug: string;
  typeId?: number;
  description?: string;
  address?: string;
  cityId?: number;
  destinationId?: string;
  latitude?: number;
  longitude?: number;
  priceRange?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  isFeatured?: boolean;
  extraFilters?: Record<string, string>;
}

export interface OwnerSubmissionDocument {
  id: string;
  documentType: string;
  documentUrl: string;
  fileName: string | null;
  contentType: string | null;
  createdAt: string;
}

export interface UpdatePlaceDto {
  name?: string;
  slug?: string;
  typeId?: number;
  description?: string;
  address?: string;
  cityId?: number;
  destinationId?: string;
  latitude?: number;
  longitude?: number;
  priceRange?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  isFeatured?: boolean;
  approvalStatus?: string;
  extraFilters?: Record<string, string>;
}
