export type EventStatus = 'pending' | 'active' | 'rejected' | 'forwarded';
export type EventType = 'concert' | 'tasting' | 'conference' | 'sport' | 'exhibition' | 'other';
export type EventPriority = 'low' | 'medium' | 'high';
export type EventsTab = 'pending' | 'active' | 'history';

export interface EventFilterOption<TValue extends string | number = string | number> {
  value: TValue;
  label: string;
}

export interface EventDocument {
  id: string;
  name: string;
  url: string;
}

export interface EventRow {
  id: string;
  queueId: string | null;
  eventNumber: string;
  name: string;
  organizer: string;
  type: EventType | null;
  city: string | null;
  venue: string | null;
  startDate: string;
  priority: EventPriority | null;
  status: EventStatus;
  heroImageUrl: string | null;
  expectedGuests: number | null;
  description: string | null;
  documents: EventDocument[];
  ownerName: string | null;
  region: string | null;
  rejectionReason: string | null;
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
  tab: EventsTab;
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
}
