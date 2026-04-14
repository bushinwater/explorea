import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ActivityDetail } from '../models/activity.model';

// Mock data za testiranje dok backend ne vrati pravi odgovor
const MOCK_ACTIVITY: ActivityDetail = {
  id: 'mock-1',
  name: 'Uspon na Midžor (Stara planina)',
  slug: 'uspon-na-midzor',
  category: { id: 1, name: 'Planinarenje' },
  avgRating: 4.9,
  durationMinutes: 420,
  price: 3500,
  difficultyLevel: 'Težak',
  previewImageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
  popularity: 98,
  country: { id: 1, name: 'Srbija' },
  description:
    'Doživite nezaboravnu avanturu usponom na Midžor (2169m), najviši vrh Stare planine. Ova tura nudi spektakularne panoramske poglede koji sežu duboko u susedne države. Staza prolazi kroz netaknutu prirodu, pašnjake i kamenite predele, pružajući istinsko planinarsko iskustvo.',
  season: { id: 2, name: 'Leto' },
  distanceKm: 14.5,
  startPoint: 'Beograd',
  extraData: { elevation: '1100 m', trailType: 'Kružna' },
  organizerWebsite: null,
  location: { lat: 43.396, lng: 22.677 },
  inclusions: [
    { id: '1', item: 'Licencirani planinski vodič' },
    { id: '2', item: 'Organizovani prevoz od Beograda' },
    { id: '3', item: 'Ulaznica za park prirode' },
    { id: '4', item: 'Osnovno putno osiguranje' },
  ],
  images: [
    { imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', sortOrder: 0 },
  ],
  reviews: [],
  similarActivities: [
    {
      id: '2',
      name: 'Rafting – Brštanovica',
      slug: 'rafting-brstanovica',
      category: { id: 2, name: 'Avantura' },
      avgRating: 4.8,
      durationMinutes: 180,
      price: 4000,
      difficultyLevel: 'Lako',
      previewImageUrl: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400',
      popularity: 85,
      country: { id: 1, name: 'Srbija' },
    },
    {
      id: '3',
      name: 'Prokletije: Maja Jezerce',
      slug: 'prokletije-maja-jezerce',
      category: { id: 1, name: 'Planinarenje' },
      avgRating: 4.7,
      durationMinutes: 600,
      price: 8000,
      difficultyLevel: 'Ekstremno',
      previewImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
      popularity: 72,
      country: { id: 4, name: 'Albanija' },
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly api = '/api/activities';
  useMock = false;

  constructor(private http: HttpClient) {}

  getBySlug(slug: string): Observable<ActivityDetail> {
    if (this.useMock) {
      return of(MOCK_ACTIVITY);
    }
    return this.http.get<ActivityDetail>(`${this.api}/${slug}`);
  }
}
