import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import {
  DestinationFilters,
  DestinationPagedResponse,
  DestinationRow,
  DestinationStats,
} from './admin-destinations.models';

const MOCK: DestinationRow[] = [
  {
    id: '1',
    name: 'Oplenac Royal Complex',
    city: 'Topola',
    region: 'Šumadija',
    category: 'cultural',
    status: 'active',
    thumbnailUrl: null,
    views: 12400,
    sparklineData: [3200, 4100, 3800, 5200, 4600, 5800, 6200],
    lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Bukovička Banja Park',
    city: 'Aranđelovac',
    region: 'Šumadija',
    category: 'nature',
    status: 'active',
    thumbnailUrl: null,
    views: 8200,
    sparklineData: [1800, 2400, 2100, 3100, 2800, 3600, 4200],
    lastUpdatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Vinarija Aleksandrović',
    city: 'Vinča',
    region: 'Šumadija',
    category: 'gastronomy',
    status: 'pending',
    thumbnailUrl: null,
    views: 3100,
    sparklineData: [800, 1200, 900, 1400, 1100, 1600, 1800],
    lastUpdatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Risovača pećina',
    city: 'Aranđelovac',
    region: 'Šumadija',
    category: 'adventure',
    status: 'rejected',
    thumbnailUrl: null,
    views: 1200,
    sparklineData: [600, 400, 300, 500, 200, 100, 150],
    lastUpdatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Gruža jezero',
    city: 'Knić',
    region: 'Šumadija',
    category: 'nature',
    status: 'active',
    thumbnailUrl: null,
    views: 6700,
    sparklineData: [1900, 2300, 2800, 2400, 3100, 3400, 3800],
    lastUpdatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    name: 'Kalemegdan tvrđava',
    city: 'Beograd',
    region: 'Beograd',
    category: 'historical',
    status: 'active',
    thumbnailUrl: null,
    views: 45600,
    sparklineData: [8200, 9100, 7800, 11200, 10600, 12800, 14200],
    lastUpdatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    name: 'Đavolja varoš',
    city: 'Kursumlija',
    region: 'Toplica',
    category: 'adventure',
    status: 'active',
    thumbnailUrl: null,
    views: 9800,
    sparklineData: [2100, 2800, 2400, 3200, 2900, 3600, 4100],
    lastUpdatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8',
    name: 'Vrnjačka Banja šetnja',
    city: 'Vrnjačka Banja',
    region: 'Raška',
    category: 'wellness',
    status: 'inactive',
    thumbnailUrl: null,
    views: 2300,
    sparklineData: [900, 800, 700, 600, 500, 400, 300],
    lastUpdatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '9',
    name: 'Tara Nacionalni park',
    city: 'Bajina Bašta',
    region: 'Zlatibor',
    category: 'nature',
    status: 'active',
    thumbnailUrl: null,
    views: 22100,
    sparklineData: [4200, 5100, 4800, 6200, 5600, 7800, 8200],
    lastUpdatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: '10',
    name: 'Studenica manastir',
    city: 'Raška',
    region: 'Raška',
    category: 'cultural',
    status: 'pending',
    thumbnailUrl: null,
    views: 5400,
    sparklineData: [1200, 1600, 1400, 1800, 1600, 2100, 2400],
    lastUpdatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '11',
    name: 'Zlatibor planina',
    city: 'Čajetina',
    region: 'Zlatibor',
    category: 'nature',
    status: 'active',
    thumbnailUrl: null,
    views: 31400,
    sparklineData: [5200, 6800, 6100, 7400, 7200, 8600, 9100],
    lastUpdatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: '12',
    name: 'Novi Sad tvrđava',
    city: 'Novi Sad',
    region: 'Vojvodina',
    category: 'historical',
    status: 'active',
    thumbnailUrl: null,
    views: 18700,
    sparklineData: [3800, 4200, 3600, 5100, 4700, 6200, 7100],
    lastUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '13',
    name: 'Uvac kanjon',
    city: 'Nova Varoš',
    region: 'Zlatibor',
    category: 'adventure',
    status: 'inactive',
    thumbnailUrl: null,
    views: 4100,
    sparklineData: [1100, 900, 800, 700, 600, 500, 400],
    lastUpdatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '14',
    name: 'Fruška Gora manastiri',
    city: 'Sremska Mitrovica',
    region: 'Vojvodina',
    category: 'cultural',
    status: 'pending',
    thumbnailUrl: null,
    views: 7300,
    sparklineData: [1600, 2100, 1900, 2400, 2200, 2800, 3100],
    lastUpdatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_STATS: DestinationStats = {
  totalViews: 248392,
  totalViewsTrend: '+12.5% od prošlog meseca',
  inactiveCount: 25,
  inactiveTrend: '+2.3% od prošlog meseca',
  pendingCount: 14,
  pendingHint: '+5 zahteva koja čekaju akciju',
  addedLast30Days: [2,4,3,5,2,6,4,7,3,5,4,6,8,5,4,7,6,9,5,8,7,10,6,8,9,11,7,9,8,12],
};

const MOCK_REGIONS = ['Šumadija', 'Beograd', 'Toplica', 'Raška', 'Zlatibor', 'Vojvodina'];

@Injectable({ providedIn: 'root' })
export class AdminDestinationsService {
  private readonly data = [...MOCK];

  getStats(): Observable<DestinationStats> {
    return of(MOCK_STATS).pipe(delay(300));
  }

  getDestinations(filters: DestinationFilters): Observable<DestinationPagedResponse> {
    let results = [...this.data];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        d => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q),
      );
    }

    if (filters.category !== 'all') {
      results = results.filter(d => d.category === filters.category);
    }

    if (filters.status !== 'all') {
      results = results.filter(d => d.status === filters.status);
    }

    if (filters.region !== 'all') {
      results = results.filter(d => d.region === filters.region);
    }

    const total = results.length;
    const from = (filters.page - 1) * filters.pageSize;
    const items = results.slice(from, from + filters.pageSize);

    return of({ items, total }).pipe(delay(200));
  }

  getRegions(): Observable<string[]> {
    return of(MOCK_REGIONS);
  }

  deleteDestination(id: string): Observable<void> {
    const idx = this.data.findIndex(d => d.id === id);
    if (idx !== -1) this.data.splice(idx, 1);
    return of(undefined).pipe(delay(300));
  }
}
