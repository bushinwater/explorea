import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  HomeData,
  HeroBanner,
  DestinationCard,
  EventCard,
  ActivityCard,
  ReviewDto,
  CityFilter,
} from '../models/home.model';

const HERO_BANNERS: HeroBanner[] = [
  {
    id: 1,
    title: 'Otkrij svoju sledeću avanturu',
    subtitle: 'Istražuj destinacije, događaje i aktivnosti širom Srbije',
    imageUrl: 'https://picsum.photos/seed/serbia-nature/1600/900',
    linkType: 'destination',
    linkSlug: 'djerdap',
  },
  {
    id: 2,
    title: 'Kopaonik te čeka',
    subtitle: 'Planinski vazduh, skijaške staze i prirodna lepota na dlanu',
    imageUrl: 'https://picsum.photos/seed/mountain-ski/1600/900',
    linkType: 'destination',
    linkSlug: 'kopaonik',
  },
  {
    id: 3,
    title: 'Đerdapska klisura',
    subtitle: 'Najduža rečna klisura u Evropi – nešto što mora da se vidi',
    imageUrl: 'https://picsum.photos/seed/canyon-river/1600/900',
    linkType: 'destination',
    linkSlug: 'djerdap-klisura',
  },
  {
    id: 4,
    title: 'Zlatibor – mir prirode',
    subtitle: 'Planinska idila na svega par sati od Beograda',
    imageUrl: 'https://picsum.photos/seed/green-hills/1600/900',
    linkType: 'destination',
    linkSlug: 'zlatibor',
  },
];

const FEATURED_DESTINATIONS: DestinationCard[] = [
  {
    id: 1,
    name: 'Kopaonik',
    slug: 'kopaonik',
    previewImageUrl: 'https://picsum.photos/seed/kopaonik-dest/400/300',
    avgRating: 4.8,
    city: { id: 4, name: 'Kopaonik' },
    location: { lat: 43.291, lng: 20.811 },
    isFeatured: true,
  },
  {
    id: 2,
    name: 'Đerdapska klisura',
    slug: 'djerdap',
    previewImageUrl: 'https://picsum.photos/seed/djerdap-dest/400/300',
    avgRating: 4.7,
    city: { id: 7, name: 'Kladovo' },
    location: { lat: 44.525, lng: 22.167 },
    isFeatured: true,
  },
  {
    id: 3,
    name: 'Zlatibor',
    slug: 'zlatibor',
    previewImageUrl: 'https://picsum.photos/seed/zlatibor-dest/400/300',
    avgRating: 4.6,
    city: { id: 5, name: 'Zlatibor' },
    location: { lat: 43.727, lng: 19.693 },
    isFeatured: true,
  },
  {
    id: 4,
    name: 'Fruška Gora',
    slug: 'fruska-gora',
    previewImageUrl: 'https://picsum.photos/seed/fruska-gora/400/300',
    avgRating: 4.5,
    city: { id: 2, name: 'Novi Sad' },
    location: { lat: 45.13, lng: 19.74 },
    isFeatured: false,
  },
  {
    id: 5,
    name: 'Tara',
    slug: 'tara',
    previewImageUrl: 'https://picsum.photos/seed/tara-mountain/400/300',
    avgRating: 4.7,
    city: { id: 8, name: 'Bajina Bašta' },
    location: { lat: 43.9, lng: 19.4 },
    isFeatured: false,
  },
  {
    id: 6,
    name: 'Stari Grad – Beograd',
    slug: 'beograd-stari-grad',
    previewImageUrl: 'https://picsum.photos/seed/belgrade-old/400/300',
    avgRating: 4.4,
    city: { id: 1, name: 'Beograd' },
    location: { lat: 44.818, lng: 20.461 },
    isFeatured: false,
  },
];

const UPCOMING_EVENTS: EventCard[] = [
  {
    id: 1,
    name: 'Exit Festival 2024',
    slug: 'exit-festival-2024',
    type: { id: 1, name: 'Muzički' },
    startDatetime: '2025-07-10T18:00:00',
    endDatetime: '2025-07-14T06:00:00',
    price: 4500,
    address: 'Petrovaradinska tvrđava',
    city: { id: 2, name: 'Novi Sad' },
    previewImageUrl: 'https://picsum.photos/seed/exit-festival/400/260',
    isFeatured: true,
  },
  {
    id: 2,
    name: 'Sajam vina – Fruška Gora',
    slug: 'sajam-vina-fruska-gora',
    type: { id: 2, name: 'Gastronomski' },
    startDatetime: '2025-05-03T11:00:00',
    endDatetime: '2025-05-05T20:00:00',
    price: null,
    address: 'Sremski Karlovci, centar',
    city: { id: 2, name: 'Novi Sad' },
    previewImageUrl: 'https://picsum.photos/seed/wine-fair/400/260',
    isFeatured: false,
  },
  {
    id: 3,
    name: 'Nišville Jazz Festival',
    slug: 'nisville-2025',
    type: { id: 1, name: 'Muzički' },
    startDatetime: '2025-08-07T20:00:00',
    endDatetime: '2025-08-11T23:59:00',
    price: 2000,
    address: 'Niška tvrđava',
    city: { id: 3, name: 'Niš' },
    previewImageUrl: 'https://picsum.photos/seed/jazz-festival/400/260',
    isFeatured: true,
  },
  {
    id: 4,
    name: 'Sabor trubača – Guča',
    slug: 'guca-2025',
    type: { id: 3, name: 'Kulturni' },
    startDatetime: '2025-08-14T12:00:00',
    endDatetime: '2025-08-17T23:00:00',
    price: 500,
    address: 'Guča, Dragačevo',
    city: { id: 9, name: 'Čačak' },
    previewImageUrl: 'https://picsum.photos/seed/trumpet-fest/400/260',
    isFeatured: false,
  },
];

const POPULAR_ACTIVITIES: ActivityCard[] = [
  {
    id: 1,
    name: 'Rafting na Drini',
    slug: 'rafting-drina',
    category: { id: 1, name: 'Rafting' },
    avgRating: 4.9,
    durationMinutes: 180,
    price: 2500,
    difficultyLevel: 'Srednji',
    previewImageUrl: 'https://picsum.photos/seed/rafting-river/400/300',
  },
  {
    id: 2,
    name: 'Planinarenje na Kopaoniku',
    slug: 'planinarenje-kopaonik',
    category: { id: 2, name: 'Planinarenje' },
    avgRating: 4.7,
    durationMinutes: 300,
    price: null,
    difficultyLevel: 'Lak',
    previewImageUrl: 'https://picsum.photos/seed/hiking-mountain/400/300',
  },
  {
    id: 3,
    name: 'Degustacija vina – Fruška Gora',
    slug: 'degustacija-vina-fruska',
    category: { id: 3, name: 'Degustacija' },
    avgRating: 4.6,
    durationMinutes: 120,
    price: 1800,
    difficultyLevel: 'Lak',
    previewImageUrl: 'https://picsum.photos/seed/wine-tasting/400/300',
  },
  {
    id: 4,
    name: 'Zip-line Tara',
    slug: 'zip-line-tara',
    category: { id: 4, name: 'Zip-line' },
    avgRating: 4.8,
    durationMinutes: 60,
    price: 1500,
    difficultyLevel: 'Lak',
    previewImageUrl: 'https://picsum.photos/seed/zipline-forest/400/300',
  },
  {
    id: 5,
    name: 'Paraglajding – Rtanj',
    slug: 'paraglajding-rtanj',
    category: { id: 5, name: 'Paraglajding' },
    avgRating: 4.9,
    durationMinutes: 90,
    price: 3500,
    difficultyLevel: 'Srednji',
    previewImageUrl: 'https://picsum.photos/seed/paragliding-sky/400/300',
  },
];

const TRAVELER_REVIEWS: ReviewDto[] = [
  {
    id: 1,
    rating: 5,
    comment:
      'Neverovatno iskustvo! Kopaonik je prelep, staze su dobro označene i osoblje je izuzetno ljubazno. Preporučujem svima.',
    createdAt: '2024-12-15T14:30:00',
    user: {
      id: 10,
      firstName: 'Marko',
      lastName: 'Jovanović',
      travelerRank: 'Zlatni putnik',
    },
  },
  {
    id: 2,
    rating: 5,
    comment:
      'Đerdapska klisura me je ostavila bez daha. Plovidba kanjonom je nešto što svako mora da doživi bar jednom u životu.',
    createdAt: '2025-01-08T10:00:00',
    user: {
      id: 11,
      firstName: 'Ana',
      lastName: 'Petrović',
      travelerRank: 'Srebrni putnik',
    },
  },
  {
    id: 3,
    rating: 4,
    comment:
      'Rafting na Drini je bio uzbudljiv. Vodič je bio profesionalac i pobrinuo se da se svi osećamo bezbedno. Odlična organizacija.',
    createdAt: '2025-02-20T09:15:00',
    user: {
      id: 12,
      firstName: 'Stefan',
      lastName: 'Nikolić',
      travelerRank: 'Bronzani putnik',
    },
  },
  {
    id: 4,
    rating: 5,
    comment:
      'Exit festival je uvek posebno iskustvo. Atmosfera je fantastična, organizacija na visokom nivou. Jedva čekamo sledeći!',
    createdAt: '2025-03-01T18:00:00',
    user: {
      id: 13,
      firstName: 'Jovana',
      lastName: 'Milošević',
      travelerRank: 'Zlatni putnik',
    },
  },
  {
    id: 5,
    rating: 4,
    comment:
      'Zlatibor je savršen za odmor. Čist vazduh, lepa priroda i ukusna domaća hrana. Svakako se vraćamo!',
    createdAt: '2025-03-10T12:00:00',
    user: {
      id: 14,
      firstName: 'Nikola',
      lastName: 'Đorđević',
      travelerRank: 'Srebrni putnik',
    },
  },
];

export const CITY_FILTERS: CityFilter[] = [
  { id: null, name: 'Popularne' },
  { id: 1, name: 'Beograd' },
  { id: 2, name: 'Novi Sad' },
  { id: 3, name: 'Niš' },
  { id: 4, name: 'Kopaonik' },
  { id: 5, name: 'Zlatibor' },
  { id: 6, name: 'Subotica' },
];

@Injectable({ providedIn: 'root' })
export class HomeService {
  getHomeData(): Observable<HomeData> {
    return of({
      heroBanners: HERO_BANNERS,
      featuredDestinations: FEATURED_DESTINATIONS,
      upcomingEvents: UPCOMING_EVENTS,
      popularActivities: POPULAR_ACTIVITIES,
      travelerReviews: TRAVELER_REVIEWS,
    });
  }

  getCityFilters(): CityFilter[] {
    return CITY_FILTERS;
  }

  getRecommendations(): Observable<DestinationCard[]> {
    return of(FEATURED_DESTINATIONS.slice(0, 3));
  }
}
