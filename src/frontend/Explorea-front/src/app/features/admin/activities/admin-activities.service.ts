import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  ActivityFilters,
  ActivityPagedResponse,
  ActivityRow,
  ActivityStats,
  ActivityStatus,
} from './admin-activities.models';

const MOCK: ActivityRow[] = [
  {
    id: '1',
    name: 'Pešačka tura Oplenac',
    city: 'Topola',
    region: 'Šumadija',
    category: 'hiking',
    status: 'active',
    difficulty: 'easy',
    thumbnailUrl: null,
    views: 12400,
    rating: 4.7,
    reviewCount: 128,
    durationMinutes: 90,
    price: 2500,
    maxCapacity: 20,
    shortDescription: 'Vođena pešačka tura kroz Oplenac i okolinu.',
    lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_STATS: ActivityStats = {
  totalActivities: 128,
  totalActivitiesTrend: '+8 novih ovog meseca',
  pendingCount: 14,
  pendingHint: '+5 zahteva koja čekaju akciju',
  averageRating: 4.4,
  averageRatingHint: 'Prosečna ocena svih aktivnosti',
  monthlyViews: 48200,
  monthlyViewsTrend: '+12.5% od prošlog meseca',
};

const MOCK_REGIONS = ['Šumadija', 'Beograd', 'Toplica', 'Raška', 'Zlatibor', 'Vojvodina'];

@Injectable({ providedIn: 'root' })
export class AdminActivitiesService {
  private readonly data = [...MOCK];

  getStats(): Observable<ActivityStats> {
    return of(MOCK_STATS).pipe(delay(300));
  }

  getActivities(filters: ActivityFilters): Observable<ActivityPagedResponse> {
    let results = [...this.data];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (d) => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q),
      );
    }

    if (filters.category !== 'all') {
      results = results.filter((d) => d.category === filters.category);
    }

    if (filters.status !== 'all') {
      results = results.filter((d) => d.status === filters.status);
    }

    if (filters.region !== 'all') {
      results = results.filter((d) => d.region === filters.region);
    }

    if (filters.difficulty !== 'all') {
      results = results.filter((d) => d.difficulty === filters.difficulty);
    }

    const minRating = filters.minRating;

    if (minRating !== 'all') {
      results = results.filter((d) => d.rating >= minRating);
    }

    const total = results.length;
    const from = (filters.page - 1) * filters.pageSize;
    const items = results.slice(from, from + filters.pageSize);

    return of({ items, total }).pipe(delay(200));
  }

  getRegions(): Observable<string[]> {
    return of(MOCK_REGIONS);
  }

  deleteActivity(id: string): Observable<void> {
    const idx = this.data.findIndex((d) => d.id === id);
    if (idx !== -1) this.data.splice(idx, 1);
    return of(undefined).pipe(delay(300));
  }

  updateActivityStatus(id: string, status: ActivityStatus): Observable<ActivityRow> {
    const activity = this.data.find((item) => item.id === id);

    if (!activity) {
      return throwError(() => new Error('Activity not found'));
    }

    activity.status = status;
    activity.lastUpdatedAt = new Date().toISOString();

    return of({ ...activity }).pipe(delay(250));
  }
}
