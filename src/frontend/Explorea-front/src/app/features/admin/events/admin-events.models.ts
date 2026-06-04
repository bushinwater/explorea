export interface InterestTagOption {
  id: number;
  name: string;
  icon: string | null;
  isAssigned?: boolean;
}

export interface ReviewItem {
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CountryOption {
  id: number;
  name: string;
}

export interface RegionWithCountry {
  id: number;
  name: string;
  countryId: number | null;
}

export interface DestinationSearchItem {
  id: string;
  name: string;
  regionId?: number | null;
  countryId?: number | null;
  regionName?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PlaceSearchItem {
  id: string;
  name: string;
  destinationId?: string | null;
  destinationName?: string | null;
  regionId?: number | null;
  countryId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export type EventStatus = 'pending' | 'active' | 'rejected' | 'forwarded' | 'deleted';
export type EventType = 'concert' | 'tasting' | 'conference' | 'sport' | 'exhibition' | 'other';
export type EventPriority = 'low' | 'medium' | 'high';
export type EventsTab = 'pending' | 'active' | 'deleted' | 'rejected';

export interface EventFilterOption<TValue extends string | number = string | number> {
  value: TValue;
  label: string;
}

export interface EventDocument {
  id: string;
  name: string;
  url: string;
  type?: string;
  uploadedAt?: string;
}

export interface EventImageItem {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface EventRow {
  id: string;
  queueId: string | null;
  eventNumber: string;
  slug: string;
  name: string;
  organizer: string;
  type: EventType | null;
  typeName: string | null;
  typeId: number | null;
  city: string | null;
  cityId: number | null;
  destinationId: string | null;
  placeId: string | null;
  venue: string | null;
  startDate: string;
  endDate: string | null;
  priority: EventPriority | null;
  status: EventStatus;
  heroImageUrl: string | null;
  imageItems: EventImageItem[];
  expectedGuests: number | null;
  description: string | null;
  price: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  ticketUrl: string | null;
  isFeatured: boolean;
  avgRating: number;
  documents: EventDocument[];
  ownerName: string | null;
  region: string | null;
  rejectionReason: string | null;
  extraFilters?: Record<string, string>;
  deletedAt?: string | null;
}

export interface EventStats {
  activeRequests: number;
  activeRequestsTrend: string;
  pendingApproval: number;
  pendingApprovalHint: string;
  approvedThisMonth: number;
  approvedThisMonthTrend: string;
  rejected: number;
  rejectedNote: string;
  tabPendingCount: number;
  tabActiveCount: number;
}

export interface EventFilters {
  search: string;
  typeId: number | null;
  cityId: number | null;
  destinationId: string | null;
  extraFilters: Record<string, string>;
  tab: EventsTab;
  sortBy: 'none' | 'updatedAt_desc' | 'updatedAt_asc';
  page: number;
  pageSize: number;
}

export interface EventPagedResponse {
  items: EventRow[];
  total: number;
}

export interface CreateEventPayload {
  name: string;
  slug: string;
  description: string | null;
  typeId: number;
  startDatetime: string;
  endDatetime: string;
  price: number | null;
  address: string | null;
  cityId: number | null;
  countryId: number | null;
  destinationId: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  ticketUrl: string | null;
  isFeatured: boolean;
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

export interface UpdateEventPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  typeId?: number;
  startDatetime?: string;
  endDatetime?: string;
  price?: number | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cityId?: number | null;
  destinationId?: string | null;
  placeId?: string | null;
  ticketUrl?: string | null;
  isFeatured?: boolean;
  extraFilters?: Record<string, string>;
}
