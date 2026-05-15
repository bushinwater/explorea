import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AdminRole, DashboardData, TrafficPoint,
  SystemStatusItem, AiInsight, StatCardData,
} from '../models/admin.models';
import { Observable, map } from 'rxjs';

interface AdminPopularEntity {
  entityType: string;
  entityId: string;
  name: string;
  views: number;
}

interface AdminStatsOverview {
  totalUsers: number;
  newUsersLast30Days: number;
  activeDestinations: number;
  mostPopularDestination: AdminPopularEntity | null;
  mostPopularEntity: AdminPopularEntity | null;
}

interface AdminTrafficPoint {
  date: string;
  views: number;
}

function trafficData(): TrafficPoint[] {
  const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
  const views = [1840, 2210, 1960, 2580, 3120, 2740, 2480];
  return days.map((day, i) => ({ day, views: views[i] }));
}

const SYSTEM_STATUS: SystemStatusItem[] = [
  { label: 'Server Load',   detail: '45%',   level: 'ok',      percentage: 45 },
  { label: 'Database',      detail: '12ms',  level: 'ok',      percentage: 12 },
  { label: 'API Response',  detail: '89ms',  level: 'ok',      percentage: 30 },
  { label: 'Storage',       detail: '72%',   level: 'warning', percentage: 72 },
];

const AI_INSIGHTS: AiInsight[] = [
  { icon: 'trending_up',   text: 'Posete su porasle 14% ove nedelje — subota je vrhunac. Razmotri promo za vikend.', type: 'positive' },
  { icon: 'warning',       text: '3 recenzije sa ocenom ispod 3 za "Kafana Pod Lipom" — preporučuje se odgovor.', type: 'warning' },
  { icon: 'lightbulb',     text: 'Korisnici iz Novog Sada pretražuju bez rezultata. Dodaj destinacije za taj region.', type: 'neutral' },
  { icon: 'star',          text: '"Tvrđava Golubac" je u top 3 po pregledima. Razmotri featured badge.', type: 'positive' },
];

const MOCK: Record<AdminRole, DashboardData> = {
  super_admin: {
    pendingCount: 12,
    stats: [
      { icon: 'people',           value: '12,482', label: 'Aktivne sesije',    trend: { value: '+8.2%', up: true },  color: 'primary' },
      { icon: 'storefront',       value: '2,840',  label: 'Aktivna mesta',     trend: { value: '+1.4%', up: true },  color: 'info'    },
      { icon: 'pending_actions',  value: '12',     label: 'Zahtevi na čekanju',trend: { value: '+3',    up: false }, color: 'warning' },
      { icon: 'support_agent',    value: '3',      label: 'Support tiketi',    trend: { value: '-1',    up: true },  color: 'accent'  },
    ],
    activity: [
      { id: '1', initials: 'MJ', avatarColor: '#28694c', text: 'Marko Jovanović je podneo zahtev za novo mesto "Splav Sunset"', timestamp: 'pre 5 min', actionLabel: 'Pregledaj', status: 'pending' },
      { id: '2', initials: 'AN', avatarColor: '#60a5fa', text: 'Ana Nikolić je odobrila događaj "Nišville Jazz Festival"', timestamp: 'pre 18 min', actionLabel: 'Pogledaj', status: 'approved' },
      { id: '3', initials: 'SP', avatarColor: '#d9b26f', text: 'Stefan Petrović ažurirao opis destinacije "Đavolja Varoš"', timestamp: 'pre 42 min', actionLabel: 'Pogledaj', status: 'info' },
      { id: '4', initials: 'MK', avatarColor: '#e57373', text: 'Milan Kostić — zahtev za "Kafana Pod Lipom" odbijen (nepotpuna dokumentacija)', timestamp: 'pre 1 h', actionLabel: 'Detalji', status: 'rejected' },
      { id: '5', initials: 'LM', avatarColor: '#a78bfa', text: 'Lena Marković je objavila recenziju ★★★★★ za "Tvrđava Golubac"', timestamp: 'pre 2 h', actionLabel: 'Pogledaj', status: 'info' },
      { id: '6', initials: 'NP', avatarColor: '#34d399', text: 'Novi korisnik Nikola Perić je registrovan i potvrđen', timestamp: 'pre 3 h', actionLabel: 'Profil', status: 'approved' },
    ],
    quickActions: [
      { id: 'add-dest',   icon: 'add_location_alt', label: 'Dodaj destinaciju', route: '/admin/destinations?create=true', colorClass: 'primary' },
      { id: 'users',      icon: 'people',           label: 'Upravljaj korisnicima', route: '/admin/users', colorClass: 'info' },
      { id: 'activities', icon: 'hiking',           label: 'Pregled aktivnosti', route: '/admin/activities', colorClass: 'warning' },
      { id: 'broadcast',  icon: 'campaign',         label: 'Broadcast obavestenje', route: '/admin/notifications/broadcast', colorClass: 'accent' },
    ],
    traffic: trafficData(),
    systemStatus: SYSTEM_STATUS,
    aiInsights: AI_INSIGHTS,
  },

  tourist_organization: {
    pendingCount: 7,
    stats: [
      { icon: 'event',            value: '24',   label: 'Aktivni događaji',  trend: { value: '+3.1%', up: true },  color: 'primary' },
      { icon: 'storefront',       value: '156',  label: 'Aktivna mesta',     trend: { value: '+0.8%', up: true },  color: 'info'    },
      { icon: 'pending_actions',  value: '7',    label: 'Zahtevi na čekanju',trend: { value: '+2',    up: false }, color: 'warning' },
      { icon: 'star',             value: '4.3',  label: 'Prosečna ocena',    trend: { value: '+0.2',  up: true },  color: 'accent'  },
    ],
    activity: [
      { id: '1', initials: 'JP', avatarColor: '#28694c', text: 'Jelena Popović podnela zahtev za aktivnost "Rafting na Drini"', timestamp: 'pre 12 min', actionLabel: 'Odobri', status: 'pending' },
      { id: '2', initials: 'DM', avatarColor: '#60a5fa', text: 'Dragana Milić ažurirala program "Exit Festival" — nova lokacija', timestamp: 'pre 35 min', actionLabel: 'Pogledaj', status: 'info' },
      { id: '3', initials: 'VM', avatarColor: '#d9b26f', text: 'Vuk Matić — zahtev za "Etno kuća Šumadija" odobren', timestamp: 'pre 1 h', actionLabel: 'Detalji', status: 'approved' },
      { id: '4', initials: 'TJ', avatarColor: '#e57373', text: 'Tamara Janković odbijen zahtev — nedostaje PIB', timestamp: 'pre 2 h', actionLabel: 'Detalji', status: 'rejected' },
      { id: '5', initials: 'BN', avatarColor: '#34d399', text: 'Bojan Nikolić dodao 5 novih slika za "Vodopad Tupavica"', timestamp: 'pre 3 h', actionLabel: 'Pogledaj', status: 'info' },
    ],
    quickActions: [
      { id: 'add-event',  icon: 'event_available', label: 'Dodaj događaj',    route: '/admin/events/new',   colorClass: 'primary' },
      { id: 'region',     icon: 'tune',            label: 'Region podešavanja',route: '/admin/settings',    colorClass: 'muted'   },
      { id: 'queue',      icon: 'queue',           label: 'Red čekanja',       route: '/admin/queue',       colorClass: 'warning' },
      { id: 'report',     icon: 'assessment',      label: 'Mesečni izveštaj',  route: '/admin/reports',     colorClass: 'info'    },
    ],
    traffic: trafficData(),
    aiInsights: AI_INSIGHTS.slice(0, 3),
  },

  place_owner: {
    pendingCount: 2,
    stats: [
      { icon: 'visibility',   value: '1,247', label: 'Pregledi mesta',    trend: { value: '+12.4%', up: true },  color: 'primary' },
      { icon: 'rate_review',  value: '48',    label: 'Recenzije',         trend: { value: '+5',     up: true },  color: 'info'    },
      { icon: 'pending_actions', value: '2', label: 'Zahtevi na čekanju', trend: { value: '',       up: false }, color: 'warning' },
      { icon: 'star',         value: '4.7',   label: 'Prosečna ocena',    trend: { value: '+0.1',   up: true },  color: 'accent'  },
    ],
    activity: [
      { id: '1', initials: 'SP', avatarColor: '#28694c', text: 'Tvoj zahtev za "Kafana Kod Mene" je na pregledu', timestamp: 'pre 1 h', actionLabel: 'Status', status: 'pending' },
      { id: '2', initials: 'AN', avatarColor: '#60a5fa', text: 'Nova recenzija ★★★★★ za tvoje mesto "Vinograd Petrović"', timestamp: 'pre 3 h', actionLabel: 'Pogledaj', status: 'approved' },
      { id: '3', initials: 'MK', avatarColor: '#d9b26f', text: 'Ažurirane informacije o radnom vremenu su prihvaćene', timestamp: 'pre 5 h', actionLabel: 'Detalji', status: 'info' },
      { id: '4', initials: 'LJ', avatarColor: '#e57373', text: 'Recenzija sa komentarom — preporučen odgovor vlasnika', timestamp: 'pre 1 d', actionLabel: 'Odgovori', status: 'warning' },
    ],
    quickActions: [
      { id: 'request',  icon: 'post_add',    label: 'Pošalji zahtev',  route: '/admin/queue/new',  colorClass: 'primary' },
      { id: 'places',   icon: 'storefront',  label: 'Moja mesta',      route: '/admin/places',     colorClass: 'info'    },
      { id: 'reviews',  icon: 'rate_review', label: 'Moje recenzije',  route: '/admin/reviews',    colorClass: 'accent'  },
      { id: 'support',  icon: 'support',     label: 'Podrška',         route: '/admin/support',    colorClass: 'muted'   },
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getData(role: AdminRole): DashboardData {
    return MOCK[role];
  }

  getOverviewStats(): Observable<StatCardData[]> {
    return this.http.get<AdminStatsOverview>('/api/admin/stats/overview').pipe(
      map((overview) => [
        {
          icon: 'people',
          value: this.formatNumber(overview.totalUsers),
          label: 'Ukupno korisnika',
          sublabel: `${this.formatNumber(overview.newUsersLast30Days)} novih u poslednjih 30 dana`,
          color: 'primary',
        },
        {
          icon: 'person_add',
          value: this.formatNumber(overview.newUsersLast30Days),
          label: 'Novi korisnici',
          sublabel: 'Poslednjih 30 dana',
          color: 'info',
        },
        {
          icon: 'location_on',
          value: this.formatNumber(overview.activeDestinations),
          label: 'Aktivne destinacije',
          sublabel: overview.mostPopularDestination
            ? `Najpopularnija: ${overview.mostPopularDestination.name}`
            : 'Nema pregleda destinacija',
          color: 'warning',
        },
        {
          icon: 'trending_up',
          value: overview.mostPopularEntity?.name ?? 'Nema podataka',
          label: 'Najpopularniji entitet',
          sublabel: overview.mostPopularEntity
            ? `${this.entityTypeLabel(overview.mostPopularEntity.entityType)} - ${this.formatNumber(overview.mostPopularEntity.views)} pregleda`
            : 'Nema zabelezenih pregleda',
          color: 'accent',
        },
      ]),
    );
  }

  getTraffic(days = 30): Observable<TrafficPoint[]> {
    return this.http.get<AdminTrafficPoint[]>(`/api/admin/stats/traffic?days=${days}`).pipe(
      map((points) => points.map((point) => ({
        day: this.formatTrafficDate(point.date),
        views: point.views,
      }))),
    );
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('sr-RS');
  }

  private entityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      destination: 'Destinacija',
      place: 'Objekat',
      event: 'Dogadjaj',
      activity: 'Aktivnost',
    };

    return labels[entityType] ?? entityType;
  }

  private formatTrafficDate(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
    });
  }
}
