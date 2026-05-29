import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  EventCard,
  EventDetail,
  EventVenueItem,
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
  useMock = false;

  constructor(private http: HttpClient) {}

  getEvents(params: EventFilterParams): Observable<EventListResponse> {
    if (this.useMock) {
      let filtered = [...MOCK_EVENTS];
      if (params.typeId) filtered = filtered.filter(e => e.type?.id === params.typeId);
      if (params.freeOnly) filtered = filtered.filter(e => !e.price);
      return of({ items: filtered, total: filtered.length });
    }

    let httpParams = new HttpParams().set('pageSize', '500');
    if (params.typeId != null)  httpParams = httpParams.set('typeId', params.typeId);
    if (params.cityId != null)  httpParams = httpParams.set('cityId', params.cityId);
    if (params.freeOnly)        httpParams = httpParams.set('freeOnly', 'true');
    if (params.date)            httpParams = httpParams.set('date', params.date);
    if (params.weekend)         httpParams = httpParams.set('weekend', 'true');

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

  getBySlug(slug: string): Observable<EventDetail> {
    if (this.useMock) {
      const found = MOCK_EVENTS.find(e => e.slug === slug) ?? MOCK_EVENTS[0];
      const detail: EventDetail = {
        ...found,
        type: { id: 1, name: 'Muzički festival' },
        description: 'EXIT Festival je jedan od najvećih muzičkih festivala u jugoistočnoj Evropi. Svake godine privlači stotine hiljada posetilaca sa svih strana sveta. Na više od 20 bina nastupaju svetski poznati izvođači elektronske, rok, hip-hop i pop muzike. Festival se održava u Petrovaradinskoj tvrđavi u Novom Sadu, jednom od najlepših prirodnih ambijenata u regionu.',
        ticketUrl: 'https://exitfest.org/tickets',
        location: { lat: 45.2519, lng: 19.8635 },
        images: [
          { imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', caption: 'Glavna bina', sortOrder: 0 },
          { imageUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800', caption: 'Publika', sortOrder: 1 },
          { imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800', caption: 'Nastup', sortOrder: 2 },
          { imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', caption: 'Noćni program', sortOrder: 3 },
          { imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', caption: 'Atmosfera', sortOrder: 4 },
        ],
        reviews: [
          { id: '1', rating: 5, comment: 'Neverovatno iskustvo! Organizacija na najvišem nivou, nezaboravne noći.', createdAt: '2025-07-20T10:00:00Z', user: { id: 'u1', firstName: 'Marko', lastName: 'P.', travelerRank: 'Putnik', profileImageUrl: null } },
          { id: '2', rating: 4, comment: 'Odlična atmosfera i sjajan izbor izvođača. Preporučujem svima!', createdAt: '2025-07-21T14:30:00Z', user: { id: 'u2', firstName: 'Ana', lastName: 'L.', travelerRank: 'Istraživač', profileImageUrl: null } },
          { id: '3', rating: 5, comment: 'Bili smo ove godine po četvrti put i svaki put je bolje i bolje.', createdAt: '2025-07-22T09:15:00Z', user: { id: 'u3', firstName: 'Stefan', lastName: 'M.', travelerRank: 'Ekspert', profileImageUrl: null } },
        ],
        similarEvents: MOCK_EVENTS.filter(e => e.slug !== slug).slice(0, 4),
        venueItems: [
          { id: '1', name: 'Petrovaradinska tvrđava', description: 'Istorijska tvrđava iz 18. veka sa pogledom na Dunav.', imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=400', slug: 'petrovaradinska-tvrdjava' },
          { id: '2', name: 'Exit Kafana', description: 'Tradicionalna kafana u srcu festivalskog kampusa.', imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400', slug: 'exit-kafana' },
          { id: '3', name: 'Camp Novi Sad', description: 'Zvanični kamp festival sa svim sadržajima.', imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', slug: 'camp-novi-sad' },
        ] as EventVenueItem[],
      };
      return of(detail);
    }
    return this.http.get<EventDetail>(`${this.api}/${slug}`);
  }

  getTypes(): Observable<EventType[]> {
    if (this.useMock) return of(MOCK_TYPES);
    return this.http.get<EventType[]>('/api/event-types');
  }
}
