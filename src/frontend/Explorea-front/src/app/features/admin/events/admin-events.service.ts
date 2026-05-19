import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, of } from 'rxjs';
import {
  EventFilters,
  EventPagedResponse,
  EventRow,
  EventStats,
  EventStatus,
  EventType,
  EventFilterOption,
} from './admin-events.models';

interface ApiEventsResponse {
  total: number;
  items: ApiEventItem[];
}

interface ApiEventItem {
  id: string;
  name: string;
  slug: string;
  previewImageUrl: string | null;
  type: string | null;
  city: string | null;
  destination: string | null;
  startDatetime: string;
  endDatetime: string;
  price: number | null;
  avgRating: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiQueueResponse {
  total: number;
  items: ApiQueueItem[];
}

interface ApiQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  destinationId: string;
  destinationName: string;
  linkedPlaceId: string | null;
  status: string;
  submittedByUserId: string;
  submittedByName: string;
  submittedAt: string;
  rejectionReason: string | null;
  reviewedByTOAt: string | null;
  reviewedByOwnerAt: string | null;
}

interface ApiLookupItem {
  id: number;
  name: string;
}

interface ApiDestinationLookupItem {
  id: string;
  name: string;
}

const MOCK_STATS: EventStats = {
  activeRequests: 14,
  activeRequestsTrend: '+3 od juče',
  pendingApproval: 8,
  pendingApprovalHint: 'Hitno rešavanje',
  approvedThisMonth: 42,
  approvedThisMonthTrend: '12% više nego prošli',
  rejected: 3,
  rejectedNote: 'Godišnji prosek 5%',
  tabPendingCount: 8,
  tabActiveCount: 24,
};

const MOCK_REGIONS = ['Beograd', 'Vojvodina', 'Zlatibor', 'Šumadija'];

@Injectable({ providedIn: 'root' })
export class AdminEventsService {
  private readonly http = inject(HttpClient);

  getStats(): Observable<EventStats> {
    return this.http.get<EventStats>('/api/admin/events/stats');
  }

  getEventTypes(): Observable<EventFilterOption<number>[]> {
    return this.http.get<ApiLookupItem[]>('/api/event-types').pipe(
      map((items) =>
        items.map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    );
  }

  getCities(): Observable<EventFilterOption<number>[]> {
    return this.http.get<ApiLookupItem[]>('/api/cities').pipe(
      map((items) =>
        items.map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    );
  }

  getDestinations(): Observable<EventFilterOption<string>[]> {
    return this.http.get<ApiDestinationLookupItem[]>('/api/destinations').pipe(
      map((items) =>
        items.map((item) => ({
          value: item.id,
          label: item.name,
        })),
      ),
    );
  }

  getEvents(filters: EventFilters): Observable<EventPagedResponse> {
    if (filters.tab === 'active') {
      return this.fetchActiveEvents(filters);
    }
    return this.fetchQueueEvents(filters);
  }

  approveEvent(queueId: string): Observable<void> {
    return this.http.put<void>(`/api/admin/events/${queueId}/approve`, {});
  }

  rejectEvent(
    queueId: string,
    reason = 'Zahtev je odbijen od strane administratora.',
  ): Observable<void> {
    return this.http.put<void>(`/api/admin/events/${queueId}/reject`, { reason });
  }

  forwardToOwner(queueId: string): Observable<void> {
    return this.http.post<void>(`/api/admin/queue/${queueId}/approve`, {});
  }

  private fetchActiveEvents(filters: EventFilters): Observable<EventPagedResponse> {
    let params = new HttpParams().set('page', filters.page).set('pageSize', filters.pageSize);

    if (filters.search.trim()) params = params.set('search', filters.search.trim());

    if (filters.typeId !== null) params = params.set('typeId', filters.typeId);

    if (filters.cityId !== null) params = params.set('cityId', filters.cityId);

    if (filters.destinationId !== null) params = params.set('destinationId', filters.destinationId);

    return this.http.get<ApiEventsResponse>('/api/admin/events', { params }).pipe(
      map((res) => ({
        total: res.total,
        items: res.items.map((e) => this.mapEventItem(e)),
      })),
    );
  }

  private fetchQueueEvents(filters: EventFilters): Observable<EventPagedResponse> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize)
      .set('entityType', 'event');

    if (filters.tab === 'pending') {
      params = params.set('status', 'Pending');
    }

    return this.http.get<ApiQueueResponse>('/api/admin/queue', { params }).pipe(
      map((res) => {
        const items = res.items
          .filter((q) => {
            if (filters.tab === 'history') {
              return [
                'RejectedByTO',
                'ApprovedByOwner',
                'RejectedByOwner',
                'ApprovedByTO',
              ].includes(q.status);
            }
            return true;
          })
          .filter((q) => {
            const search = filters.search.trim().toLowerCase();

            if (!search) return true;

            return (
              q.submittedByName?.toLowerCase().includes(search) ||
              q.destinationName?.toLowerCase().includes(search)
            );
          })
          .map((q) => this.mapQueueItem(q));
        return { total: items.length, items };
      }),
    );
  }

  private mapEventItem(e: ApiEventItem): EventRow {
    return {
      id: e.id,
      queueId: null,
      eventNumber: `EV-${e.id.substring(0, 6).toUpperCase()}`,
      name: e.name,
      organizer: '—',
      type: this.mapType(e.type),
      city: e.city,
      venue: e.destination,
      startDate: e.startDatetime,
      priority: null,
      status: 'active',
      heroImageUrl: e.previewImageUrl,
      expectedGuests: null,
      description: null,
      documents: [],
      ownerName: null,
      region: e.city,
      rejectionReason: null,
    };
  }

  private mapQueueItem(q: ApiQueueItem): EventRow {
    return {
      id: q.entityId,
      queueId: q.id,
      eventNumber: `Q-${q.id.substring(0, 6).toUpperCase()}`,
      name: q.destinationName,
      organizer: q.submittedByName,
      type: null,
      city: null,
      venue: q.destinationName,
      startDate: q.submittedAt,
      priority: null,
      status: this.mapQueueStatus(q.status),
      heroImageUrl: null,
      expectedGuests: null,
      description: null,
      documents: [],
      ownerName: q.linkedPlaceId ? 'Vlasnik objekta' : null,
      region: null,
      rejectionReason: q.rejectionReason,
    };
  }

  private mapType(type: string | null): EventType | null {
    if (!type) return null;
    const map: Record<string, EventType> = {
      Concert: 'concert',
      Tasting: 'tasting',
      Conference: 'conference',
      Sport: 'sport',
      Exhibition: 'exhibition',
    };
    return map[type] ?? 'other';
  }

  private mapQueueStatus(status: string): EventStatus {
    const map: Record<string, EventStatus> = {
      Pending: 'pending',
      ApprovedByTO: 'forwarded',
      RejectedByTO: 'rejected',
      ApprovedByOwner: 'active',
      RejectedByOwner: 'rejected',
    };
    return map[status] ?? 'pending';
  }
}
