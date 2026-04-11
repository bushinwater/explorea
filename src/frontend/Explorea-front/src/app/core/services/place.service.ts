import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { PlaceDetail } from '../models/place.model';

const MOCK_PLACE: PlaceDetail = {
  id: 'mock-place-1',
  name: 'Hotel Zlatni Bor & Spa Resort',
  slug: 'hotel-zlatni-bor-spa-resort',
  type: { id: 1, name: 'Premium Smeštaj' },
  avgRating: 4.95,
  address: 'Kralja Aleksandra 42, Zlatibor, Srbija',
  distanceKm: 1.2,
  previewImageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
  isOpen: true,
  priceRange: null,
  pricePerNight: 145,
  popularity: 980,
  country: { id: 1, name: 'Srbija', code: 'SRB' },
  city: { id: 3, name: 'Zlatibor' },
  destination: { name: 'Zlatibor', slug: 'zlatibor' },
  description:
    'Hotel Zlatni Bor nudi jedinstven spoj tradicionalnog planinskog ambijenta i modernog luksuza. Smešten u samom srcu Zlatibora, naš resort je idealan za one koji traže mir, vrhunski spa centar i nezaboravnu gastronomsku ponudu. Svaka soba je dizajnirana da pruži maksimalnu udobnost sa pogledom na borove šume. Naš tim je uvek na raspolaganju kako bi vaš boravak bio nezaboravan.',
  phone: '+381 31 123 456',
  websiteUrl: 'https://hotelzlatnibor.rs',
  location: { lat: 43.725, lng: 19.7003 },
  images: [
    { imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=900&q=80', caption: null, sortOrder: 0 },
    { imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80', caption: null, sortOrder: 1 },
    { imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80', caption: null, sortOrder: 2 },
    { imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', caption: null, sortOrder: 3 },
    { imageUrl: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80', caption: null, sortOrder: 4 },
  ],
  amenities: [
    { id: 1, name: 'PLACE_DETAIL.AMENITIES.WIFI', icon: 'wifi' },
    { id: 2, name: 'PLACE_DETAIL.AMENITIES.PARKING', icon: 'local_parking' },
    { id: 3, name: 'PLACE_DETAIL.AMENITIES.POOL', icon: 'pool' },
    { id: 4, name: 'PLACE_DETAIL.AMENITIES.BREAKFAST', icon: 'free_breakfast' },
    { id: 5, name: 'PLACE_DETAIL.AMENITIES.SECURITY', icon: 'security' },
    { id: 6, name: 'PLACE_DETAIL.AMENITIES.RESTAURANT', icon: 'restaurant' },
  ],
  workingDays: [
    { dayOfWeek: 1, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
    { dayOfWeek: 2, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
    { dayOfWeek: 3, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
    { dayOfWeek: 4, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
    { dayOfWeek: 5, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
    { dayOfWeek: 6, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
    { dayOfWeek: 0, isClosed: false, intervals: [{ opensAt: '00:00', closesAt: '23:59' }] },
  ],
  events: [],
  reviews: [
    {
      id: 'r1',
      rating: 5,
      comment: 'Savršen odmor! Sobe su sjajne, osoblje izuzetno ljubazno. Spa centar je fantastičan.',
      createdAt: '2024-08-20T10:00:00Z',
      user: { id: 'u1', firstName: 'Ana', lastName: 'Petrović', travelerRank: 'explorer' },
    },
    {
      id: 'r2',
      rating: 5,
      comment: 'Neverovatna lokacija i pogled. Doručak je bio odličan, toplo preporučujem!',
      createdAt: '2024-08-15T09:30:00Z',
      user: { id: 'u2', firstName: 'Marko', lastName: 'Jovanović', travelerRank: 'adventurer' },
    },
  ],
  similarPlaces: [
    {
      id: 'sp1',
      name: 'Planinski Raj Resort',
      slug: 'planinski-raj-resort',
      type: { id: 1, name: 'Smeštaj' },
      avgRating: 4.8,
      address: 'Zlatibor',
      distanceKm: 2.1,
      previewImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
      isOpen: true,
      priceRange: null,
      pricePerNight: 120,
      popularity: 850,
      country: { id: 1, name: 'Srbija', code: 'SRB' },
      city: { id: 3, name: 'Zlatibor' },
    },
    {
      id: 'sp2',
      name: 'Vila Borovi',
      slug: 'vila-borovi',
      type: { id: 1, name: 'Smeštaj' },
      avgRating: 4.7,
      address: 'Zlatibor',
      distanceKm: 3.5,
      previewImageUrl: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=400&q=80',
      isOpen: true,
      priceRange: null,
      pricePerNight: 95,
      popularity: 720,
      country: { id: 1, name: 'Srbija', code: 'SRB' },
      city: { id: 3, name: 'Zlatibor' },
    },
    {
      id: 'sp3',
      name: 'Grand Hotel Zlatibor',
      slug: 'grand-hotel-zlatibor',
      type: { id: 1, name: 'Smeštaj' },
      avgRating: 4.9,
      address: 'Zlatibor',
      distanceKm: 0.8,
      previewImageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&q=80',
      isOpen: true,
      priceRange: null,
      pricePerNight: 190,
      popularity: 1100,
      country: { id: 1, name: 'Srbija', code: 'SRB' },
      city: { id: 3, name: 'Zlatibor' },
    },
  ],
  totalReviews: 128,
  viewsLast24h: 45,
  hostName: 'Marko & Jelena',
  hostAvatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&q=80',
  checkInTime: '14:00',
  checkOutTime: '10:00',
  houseRules: [
    { label: 'PLACE_DETAIL.RULES.CHECK_IN', value: 'od 14:00' },
    { label: 'PLACE_DETAIL.RULES.CHECK_OUT', value: 'do 10:00' },
    { label: 'PLACE_DETAIL.RULES.PETS', value: 'PLACE_DETAIL.RULES.PETS_VALUE' },
    { label: 'PLACE_DETAIL.RULES.SMOKING', value: 'PLACE_DETAIL.RULES.SMOKING_VALUE' },
  ],
  whatOffers: [
    'PLACE_DETAIL.OFFERS.BALCONY',
    'PLACE_DETAIL.OFFERS.AC',
    'PLACE_DETAIL.OFFERS.TV',
    'PLACE_DETAIL.OFFERS.COFFEE',
    'PLACE_DETAIL.OFFERS.MINIBAR',
  ],
  openingHours: '00:00 - 24:00',
};

@Injectable({ providedIn: 'root' })
export class PlaceService {
  private readonly api = '/api/places';
  useMock = true;

  constructor(private http: HttpClient) {}

  getBySlug(slug: string): Observable<PlaceDetail> {
    if (this.useMock) {
      return of(MOCK_PLACE);
    }
    return this.http.get<PlaceDetail>(`${this.api}/${slug}`);
  }
}
