import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  EventFilters,
  EventImageItem,
  EventPagedResponse,
  EventRow,
  EventStats,
  EventStatus,
  EventType,
  EventFilterOption,
  CreateEventPayload,
  UpdateEventPayload,
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
  deletedAt?: string | null;
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

interface ApiEventDetailItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  typeId: number;
  type: string | null;
  cityId: number | null;
  city: string | null;
  countryId: number | null;
  country: string | null;
  destinationId: string | null;
  destination: string | null;
  placeId: string | null;
  place: string | null;
  startDatetime: string;
  endDatetime: string;
  price: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  ticketUrl: string | null;
  avgRating: number;
  popularity: number;
  isFeatured: boolean;
  images: { id: string; imageUrl: string; sortOrder: number }[];
  createdAt: string;
  updatedAt: string;
}

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
    if (filters.tab === 'deleted') {
      return this.fetchDeletedEvents(filters);
    }

    if (filters.tab === 'active') {
      return this.fetchActiveEvents(filters);
    }
    return this.fetchQueueEvents(filters);
  }

  approveEvent(queueId: string): Observable<void> {
    return this.http.put<void>(`/api/admin/events/${queueId}/approve`, {});
  }

  getEventDetail(eventId: string, base?: EventRow): Observable<EventRow> {
    return this.http
      .get<ApiEventDetailItem>(`/api/admin/events/${eventId}`)
      .pipe(map((event) => this.mapEventDetail(event, base)));
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

  createEvent(payload: CreateEventPayload): Observable<EventRow> {
    return this.http
      .post<ApiEventDetailItem>('/api/admin/events', payload)
      .pipe(map((event) => this.mapEventDetail(event)));
  }

  updateEvent(id: string, payload: UpdateEventPayload): Observable<EventRow> {
    return this.http
      .put<ApiEventDetailItem>(`/api/admin/events/${id}`, payload)
      .pipe(map((event) => this.mapEventDetail(event)));
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/events/${id}`);
  }

  uploadEventImage(id: string, file: File): Observable<EventImageItem> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<EventImageItem>(`/api/admin/events/${id}/images`, form);
  }

  setHeroEventImage(id: string, imageId: string): Observable<void> {
    return this.http.put<void>(`/api/admin/events/${id}/images/${imageId}/hero`, {});
  }

  deleteEventImage(id: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/events/${id}/images/${imageId}`);
  }

  private fetchActiveEvents(filters: EventFilters): Observable<EventPagedResponse> {
    let params = new HttpParams().set('page', filters.page).set('pageSize', filters.pageSize);

    if (filters.search.trim()) params = params.set('search', filters.search.trim());

    if (filters.typeId !== null) params = params.set('typeId', filters.typeId);

    if (filters.cityId !== null) params = params.set('cityId', filters.cityId);

    if (filters.destinationId !== null) params = params.set('destinationId', filters.destinationId);

    for (const [key, value] of Object.entries(filters.extraFilters ?? {})) {
      params = params.append('extraFilters', `${key}:${value}`);
    }

    return this.http.get<ApiEventsResponse>('/api/admin/events', { params }).pipe(
      map((res) => ({
        total: res.total,
        items: res.items.map((e) => this.mapEventItem(e)),
      })),
    );
  }

  private fetchDeletedEvents(filters: EventFilters): Observable<EventPagedResponse> {
    let params = new HttpParams().set('page', filters.page).set('pageSize', filters.pageSize);

    if (filters.search.trim()) params = params.set('search', filters.search.trim());

    if (filters.typeId !== null) params = params.set('typeId', filters.typeId);

    if (filters.cityId !== null) params = params.set('cityId', filters.cityId);

    if (filters.destinationId !== null) params = params.set('destinationId', filters.destinationId);

    return this.http.get<ApiEventsResponse>('/api/admin/events/deleted', { params }).pipe(
      map((res) => ({
        total: res.total,
        items: res.items.map((e) => this.mapEventItem(e, 'deleted')),
      })),
    );
  }

  private fetchQueueEvents(filters: EventFilters): Observable<EventPagedResponse> {
    const search = filters.search.trim();

    const shouldClientFilterAndPaginate = !!search || filters.tab === 'history';

    let params = new HttpParams()
      .set('page', shouldClientFilterAndPaginate ? 1 : filters.page)
      .set('pageSize', shouldClientFilterAndPaginate ? 500 : filters.pageSize)
      .set('entityType', 'event');

    if (filters.tab === 'pending') {
      params = params.set('status', 'Pending');
    }

    return this.http.get<ApiQueueResponse>('/api/admin/queue', { params }).pipe(
      map((res) => {
        const rows = res.items
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
          .map((q) => this.mapQueueItem(q));

        return {
          total: res.total,
          rows,
        };
      }),
      switchMap(({ total, rows }) => {
        if (!rows.length) {
          return of({
            total: 0,
            items: [],
          });
        }

        return forkJoin(
          rows.map((row) => this.getEventDetail(row.id, row).pipe(catchError(() => of(row)))),
        ).pipe(
          map((detailedRows) => {
            const filteredRows = detailedRows.filter((row) => this.matchesQueueSearch(row, search));

            if (!shouldClientFilterAndPaginate) {
              return {
                total,
                items: detailedRows,
              };
            }

            const start = (filters.page - 1) * filters.pageSize;
            const end = start + filters.pageSize;

            return {
              total: filteredRows.length,
              items: filteredRows.slice(start, end),
            };
          }),
        );
      }),
    );
  }

  private matchesQueueSearch(row: EventRow, search: string): boolean {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return [
      row.name,
      row.organizer,
      row.type ? this.typeLabelForSearch(row.type) : null,
      row.city,
      row.venue,
      row.description,
      row.rejectionReason,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term));
  }

  private typeLabelForSearch(type: EventType): string {
    const map: Record<EventType, string> = {
      concert: 'koncert',
      tasting: 'degustacija',
      conference: 'konferencija',
      sport: 'sport',
      exhibition: 'izložba',
      other: 'ostalo',
    };

    return map[type];
  }

  private mapEventItem(e: ApiEventItem, status: EventStatus = 'active'): EventRow {
    return {
      id: e.id,
      queueId: null,
      eventNumber: `EV-${e.id.substring(0, 6).toUpperCase()}`,
      slug: e.slug,
      name: e.name,
      organizer: '—',
      type: this.mapType(e.type),
      typeId: null,
      city: e.city,
      cityId: null,
      destinationId: null,
      venue: e.destination,
      startDate: e.startDatetime,
      endDate: e.endDatetime,
      priority: null,
      status,
      heroImageUrl: e.previewImageUrl,
      imageItems: [],
      expectedGuests: null,
      description: null,
      price: e.price,
      address: null,
      latitude: null,
      longitude: null,
      ticketUrl: null,
      isFeatured: e.isFeatured,
      documents: [],
      ownerName: null,
      region: e.city,
      rejectionReason: null,
      deletedAt: e.deletedAt ?? null,
    };
  }

  private mapQueueItem(q: ApiQueueItem): EventRow {
    return {
      id: q.entityId,
      queueId: q.id,
      eventNumber: `Q-${q.id.substring(0, 6).toUpperCase()}`,
      slug: '',
      name: q.destinationName,
      organizer: q.submittedByName,
      type: null,
      typeId: null,
      city: null,
      cityId: null,
      destinationId: q.destinationId ?? null,
      venue: q.destinationName,
      startDate: q.submittedAt,
      endDate: null,
      priority: null,
      status: this.mapQueueStatus(q.status),
      heroImageUrl: null,
      imageItems: [],
      expectedGuests: null,
      description: null,
      price: null,
      address: null,
      latitude: null,
      longitude: null,
      ticketUrl: null,
      isFeatured: false,
      documents: [],
      ownerName: q.linkedPlaceId ? 'Vlasnik objekta' : null,
      region: null,
      rejectionReason: q.rejectionReason,
      deletedAt: null,
    };
  }

  private mapEventDetail(e: ApiEventDetailItem, base?: EventRow): EventRow {
    const imgs = e.images ?? [];
    return {
      id: e.id,
      queueId: base?.queueId ?? null,
      eventNumber: base?.eventNumber ?? `EV-${e.id.substring(0, 6).toUpperCase()}`,
      slug: e.slug,
      name: e.name,
      organizer: base?.organizer ?? '—',
      type: this.mapType(e.type),
      typeId: e.typeId ?? null,
      city: e.city,
      cityId: e.cityId ?? null,
      destinationId: e.destinationId ?? null,
      venue: e.place ?? e.destination ?? e.address,
      startDate: e.startDatetime,
      endDate: e.endDatetime,
      priority: base?.priority ?? null,
      status: base?.status ?? 'active',
      heroImageUrl: imgs[0]?.imageUrl ?? base?.heroImageUrl ?? null,
      imageItems: imgs,
      expectedGuests: base?.expectedGuests ?? null,
      description: e.description,
      price: e.price ?? null,
      address: e.address ?? null,
      latitude: e.latitude ?? null,
      longitude: e.longitude ?? null,
      ticketUrl: e.ticketUrl ?? null,
      isFeatured: e.isFeatured ?? false,
      documents: base?.documents ?? [],
      ownerName: base?.ownerName ?? (e.placeId ? 'Vlasnik objekta' : null),
      region: e.city,
      rejectionReason: base?.rejectionReason ?? null,
      deletedAt: base?.deletedAt ?? null,
    };
  }

  private mapType(type: string | null): EventType | null {
    if (!type) return null;

    const map: Record<string, EventType> = {
      Concert: 'concert',
      Koncert: 'concert',

      Tasting: 'tasting',
      Degustacija: 'tasting',

      Conference: 'conference',
      Konferencija: 'conference',

      Sport: 'sport',

      Exhibition: 'exhibition',
      Izložba: 'exhibition',
      Izlozba: 'exhibition',
    };

    return map[type] ?? 'other';
  }

  private mapQueueStatus(status: string): EventStatus {
    const map: Record<string, EventStatus> = {
      Pending: 'pending',
      ApprovedByTO: 'active',
      ApprovedByOwner: 'active',
      RejectedByTO: 'rejected',
      RejectedByOwner: 'rejected',
    };
    return map[status] ?? 'pending';
  }
}
