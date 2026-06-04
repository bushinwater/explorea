import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ObjectRequest, RequestDocument, RequestStatus } from './object-requests.models';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

interface ApiQueueResponse {
  items: ApiQueueItem[];
}

interface ApiQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  destinationName: string;
  status: string;
  submittedByName: string;
  submittedAt: string;
  rejectionReason: string | null;
  documents?: ApiOwnerDocument[];
}

interface ApiOwnerDocument {
  id: string;
  documentType: string;
  documentUrl: string;
  fileName: string | null;
  contentType: string | null;
  createdAt: string;
}

interface ApiPlaceDetail {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  destination: string | null;
  description: string | null;
  phone: string | null;
  websiteUrl: string | null;
  images: { imageUrl: string }[];
}

@Injectable({ providedIn: 'root' })
export class ObjectRequestsService {
  private readonly http: HttpClient;

  private _request = signal<ObjectRequest | null>(null);
  readonly request = this._request.asReadonly();

  private _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly ui: AdminUiPreferencesService;

  constructor(http: HttpClient, ui: AdminUiPreferencesService) {
    this.http = http;
    this.ui = ui;
  }

  private get dateLocale(): string { return this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS'; }

  loadRequestById(id: string): void {
    this._loading.set(true);

    this.fetchRequest(id).subscribe({
      next: request => {
        this._request.set(request);
        this._loading.set(false);
      },
      error: () => {
        this._request.set(null);
        this._loading.set(false);
      },
    });
  }

  approveRequest(comment?: string): Observable<void> {
    const req = this._request();
    if (!req) return of(void 0);

    return this.http.post<void>(`/api/admin/queue/${req.id}/approve`, {}).pipe(
      tap(() => this._request.set({ ...req, status: 'approved', adminComment: comment })),
    );
  }

  rejectRequest(reason: string): Observable<void> {
    const req = this._request();
    if (!req) return of(void 0);

    return this.http.post<void>(`/api/admin/queue/${req.id}/reject`, { reason }).pipe(
      tap(() => this._request.set({ ...req, status: 'rejected', rejectionReason: reason })),
    );
  }

  private fetchRequest(id: string): Observable<ObjectRequest> {
    const params = new HttpParams()
      .set('entityType', 'place')
      .set('page', '1')
      .set('pageSize', '500');

    return this.http.get<ApiQueueResponse>('/api/admin/queue', { params }).pipe(
      map(response => {
        const item = response.items.find(q => q.id === id || q.entityId === id);
        if (!item) throw new Error('Request not found.');
        return item;
      }),
      switchMap(queueItem =>
        forkJoin({
          place: this.http.get<ApiPlaceDetail>(`/api/admin/places/${queueItem.entityId}`),
          queueItem: of(queueItem),
        }),
      ),
      map(({ place, queueItem }) => this.mapRequest(queueItem, place)),
    );
  }

  private mapRequest(queueItem: ApiQueueItem, place: ApiPlaceDetail): ObjectRequest {
    const docs: RequestDocument[] = (queueItem.documents ?? []).map(doc => ({
      id: doc.id,
      name: doc.fileName || this.documentLabel(doc.documentType),
      url: doc.documentUrl,
      size: doc.contentType ?? undefined,
    }));

    return {
      id: queueItem.id,
      requestNumber: `OBJ-${queueItem.id.substring(0, 8).toUpperCase()}`,
      entityId: queueItem.entityId,
      name: place.name,
      city: place.city ?? queueItem.destinationName,
      address: place.address ?? place.destination ?? queueItem.destinationName,
      region: place.region ?? '',
      submittedAt: new Date(queueItem.submittedAt).toLocaleString(this.dateLocale),
      heroImageUrl: place.images?.[0]?.imageUrl ?? '',
      priority: 'medium',
      contactPhone: place.phone ?? undefined,
      website: place.websiteUrl ?? undefined,
      description: place.description ?? '',
      features: {
        accessibility: '',
        parkingSpaces: '',
        ecoCertified: '',
        openingHours: '',
      },
      documents: docs,
      status: this.mapStatus(queueItem.status),
      rejectionReason: queueItem.rejectionReason ?? undefined,
      pipelineSteps: [
        {
          label: 'Podnet zahtev',
          actor: queueItem.submittedByName,
          date: new Date(queueItem.submittedAt).toLocaleString(this.dateLocale),
          comment: 'Vlasnik je podneo zahtev za novi objekat.',
          state: 'done',
        },
        {
          label: 'Pregled dokumentacije',
          actor: 'Superadmin / TO',
          comment: 'Provera podataka, regije i prilozenih dokumenata.',
          state: queueItem.status === 'Pending' ? 'active' : 'done',
        },
      ],
    };
  }

  private mapStatus(status: string): RequestStatus {
    if (status === 'RejectedByTO' || status === 'RejectedByOwner') return 'rejected';
    if (status === 'ApprovedByTO' || status === 'ApprovedByOwner') return 'approved';
    return 'pending';
  }

  private documentLabel(type: string): string {
    const labels: Record<string, string> = {
      identity: 'Licni dokument',
      authorization: 'Dokaz vlasnistva/ovlascenja',
      license: 'Licenca/dozvola',
      other: 'Dokument',
    };

    return labels[type] ?? 'Dokument';
  }
}
