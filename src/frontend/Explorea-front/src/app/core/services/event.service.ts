import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  EventCard,
  EventListResponse,
  CalendarDay,
  EventFilterParams,
  EventType,
} from '../models/event.model';

const MOCK_EVENTS: EventCard[] = [
  {
    id: '1', name: 'Letnji Jazz Festival u Bašti', slug: 'letnji-jazz-festival-basta',
    type: { id: 1, name: 'Muzika' },
    startDatetime: '2026-07-15T20:00:00+02:00', endDatetime: '2026-07-15T23:30:00+02:00',
    price: 500, address: 'Botanička bašta, Beograd', city: { id: 1, name: 'Beograd' },
    previewImageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
    isFeatured: true, popularity: 95, latitude: 44.8065, longitude: 20.4741,
  },
  {
    id: '2', name: 'Srbija vs. Brazil – Odbojka', slug: 'srbija-brazil-odbojka',
    type: { id: 3, name: 'Sport' },
    startDatetime: '2026-07-16T18:00:00+02:00', endDatetime: '2026-07-16T21:00:00+02:00',
    price: 1000, address: 'Beogradska Arena', city: { id: 1, name: 'Beograd' },
    previewImageUrl: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600',
    isFeatured: false, popularity: 88, latitude: 44.8052, longitude: 20.4622,
  },
  {
    id: '3', name: 'Noćni planinarski marš na Avali', slug: 'nocni-planinarenje-avala',
    type: { id: 5, name: 'Priroda' },
    startDatetime: '2026-07-17T21:00:00+02:00', endDatetime: '2026-07-18T02:00:00+02:00',
    price: null, address: 'Avala, Beograd', city: { id: 1, name: 'Beograd' },
    previewImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
    isFeatured: false, popularity: 72, latitude: 44.6914, longitude: 20.5125,
  },
  {
    id: '4', name: 'Radionica: Tradicionalna keramika', slug: 'radionica-keramika',
    type: { id: 4, name: 'Edukacija' },
    startDatetime: '2026-07-18T10:00:00+02:00', endDatetime: '2026-07-18T13:00:00+02:00',
    price: null, address: 'Kulturni centar Grad', city: { id: 1, name: 'Beograd' },
    previewImageUrl: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600',
    isFeatured: false, popularity: 55, latitude: 44.8178, longitude: 20.4568,
  },
  {
    id: '5', name: 'Vinski Festival: Okusi Fruške Gore', slug: 'vinski-festival-fruska-gora',
    type: { id: 2, name: 'Kultura' },
    startDatetime: '2026-07-24T14:00:00+02:00', endDatetime: '2026-07-24T22:00:00+02:00',
    price: 1200, address: 'Vinarija Kovačević, Irič', city: { id: 2, name: 'Novi Sad' },
    previewImageUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600',
    isFeatured: true, popularity: 91, latitude: 45.1021, longitude: 19.8634,
  },
  {
    id: '6', name: 'Koncert: Jazz pod zvezdama', slug: 'koncert-jazz-pod-zvezdama',
    type: { id: 1, name: 'Muzika' },
    startDatetime: '2026-07-24T20:30:00+02:00', endDatetime: '2026-07-24T23:30:00+02:00',
    price: null, address: 'Kalemegdan, Beograd', city: { id: 1, name: 'Beograd' },
    previewImageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    isFeatured: false, popularity: 84, latitude: 44.8231, longitude: 20.4488,
  },
  {
    id: '7', name: 'Noć Muzeja: Skrivena blaga istorije', slug: 'noc-muzeja-skrivena-blaga',
    type: { id: 2, name: 'Kultura' },
    startDatetime: '2026-07-24T18:00:00+02:00', endDatetime: '2026-07-25T02:00:00+02:00',
    price: 500, address: 'Narodni muzej, Beograd', city: { id: 1, name: 'Beograd' },
    previewImageUrl: 'https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=600',
    isFeatured: false, popularity: 78, latitude: 44.8020, longitude: 20.4671,
  },
  {
    id: '8', name: 'Planinska tura: Uspon na Rtanj', slug: 'tura-uspon-rtanj',
    type: { id: 5, name: 'Priroda' },
    startDatetime: '2026-07-25T07:00:00+02:00', endDatetime: '2026-07-25T17:00:00+02:00',
    price: 2500, address: 'Planina Rtanj, Istočna Srbija', city: { id: 3, name: 'Niš' },
    previewImageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
    isFeatured: false, popularity: 67, latitude: 43.7581, longitude: 21.8920,
  },
];

const MOCK_TYPES: EventType[] = [
  { id: 1, name: 'Muzika' },
  { id: 2, name: 'Kultura' },
  { id: 3, name: 'Sport' },
  { id: 4, name: 'Edukacija' },
  { id: 5, name: 'Priroda' },
];

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = '/api/events';
  useMock = true;

  constructor(private http: HttpClient) {}

  getEvents(params: EventFilterParams): Observable<EventListResponse> {
    if (this.useMock) {
      let filtered = [...MOCK_EVENTS];
      if (params.typeId) filtered = filtered.filter(e => e.type.id === params.typeId);
      if (params.free) filtered = filtered.filter(e => !e.price);
      return of({ items: filtered, total: filtered.length });
    }

    let httpParams = new HttpParams();
    if (params.typeId != null) httpParams = httpParams.set('typeId', params.typeId.toString());
    if (params.free) httpParams = httpParams.set('free', 'true');
    if (params.cityId != null) httpParams = httpParams.set('cityId', params.cityId.toString());

    return this.http.get<EventListResponse>(this.api, { params: httpParams });
  }

  getCalendar(year: number, month: number): Observable<CalendarDay[]> {
    if (this.useMock) {
      const mockCalendar: CalendarDay[] = [
        { date: '2026-07-15', count: 3, events: MOCK_EVENTS.slice(0, 3) },
        { date: '2026-07-16', count: 1, events: [MOCK_EVENTS[1]] },
        { date: '2026-07-17', count: 1, events: [MOCK_EVENTS[2]] },
        { date: '2026-07-18', count: 1, events: [MOCK_EVENTS[3]] },
        { date: '2026-07-24', count: 3, events: MOCK_EVENTS.slice(4, 7) },
        { date: '2026-07-25', count: 2, events: [MOCK_EVENTS[6], MOCK_EVENTS[7]] },
      ];
      return of(mockCalendar);
    }
    return this.http.get<CalendarDay[]>(`${this.api}/calendar`, {
      params: { year: year.toString(), month: month.toString() },
    });
  }

  getTypes(): EventType[] {
    return MOCK_TYPES;
  }
}
