import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AdminRole, AiChatMessage, AiChatResponse, AiInsight,
  ActivityItem, ActivityStatus, QuickAction, StatCardData,
  SystemStatusItem, TrafficPoint,
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

interface AdminRecentActivity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  actorId: string | null;
}

interface AdminSystemStatusItem {
  label: string;
  detail: string;
  level: 'ok' | 'warning' | 'critical';
  percentage?: number | null;
}

interface AdminAiChatResponse {
  message: string;
  insights: AiInsight[];
}

const QUICK_ACTIONS: Record<AdminRole, QuickAction[]> = {
  super_admin: [
    { id: 'add-dest',   icon: 'add_location_alt', label: 'Dodaj destinaciju',       route: '/admin/destinations?create=true', colorClass: 'primary' },
    { id: 'users',      icon: 'people',           label: 'Upravljaj korisnicima',    route: '/admin/users',                   colorClass: 'info'    },
    { id: 'activities', icon: 'hiking',           label: 'Pregled aktivnosti',        route: '/admin/activities',              colorClass: 'warning' },
    { id: 'broadcast',  icon: 'campaign',         label: 'Broadcast obavestenje',    route: '/admin/notifications/broadcast', colorClass: 'accent'  },
  ],
  tourist_organization: [
    { id: 'add-event', icon: 'event_available', label: 'Dodaj dogadjaj',      route: '/admin/events?create=true', colorClass: 'primary' },
    { id: 'region',    icon: 'tune',            label: 'Region podesavanja',   route: '/admin/settings',          colorClass: 'muted'   },
    { id: 'reviews',   icon: 'rate_review',     label: 'Pregled recenzija',    route: '/admin/reviews',           colorClass: 'warning' },
    { id: 'report',    icon: 'assessment',      label: 'Mesecni izvestaj',     route: '/admin/reports',           colorClass: 'info'    },
  ],
  place_owner: [
    { id: 'dashboard', icon: 'dashboard',   label: 'Pregled naloga', route: '/admin/dashboard', colorClass: 'primary' },
    { id: 'settings',  icon: 'settings',    label: 'Podesavanja',    route: '/admin/settings',  colorClass: 'info'    },
    { id: 'reviews',   icon: 'rate_review', label: 'Moje recenzije', route: '/admin/reviews',   colorClass: 'accent'  },
    { id: 'support',   icon: 'support',     label: 'Podrska',        route: '/admin/support',   colorClass: 'muted'   },
  ],
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getQuickActions(role: AdminRole): QuickAction[] {
    return QUICK_ACTIONS[role] ?? [];
  }

  getPendingCount(): Observable<number> {
    return this.http.get<{ count: number }>('/api/admin/stats/pending-count').pipe(
      map(r => r.count),
    );
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
      ] as StatCardData[]),
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

  getRecentActivity(limit = 10): Observable<ActivityItem[]> {
    return this.http.get<AdminRecentActivity[]>(`/api/admin/activity/recent?limit=${limit}`).pipe(
      map((items) => items.map((item) => ({
        id: item.id,
        initials: this.activityInitials(item.type),
        avatarColor: this.activityColor(item.type),
        text: item.description,
        timestamp: this.formatTimeAgo(item.createdAt),
        actionLabel: 'Detalji',
        status: this.activityStatus(item.type),
      }))),
    );
  }

  getSystemStatus(): Observable<SystemStatusItem[]> {
    return this.http.get<AdminSystemStatusItem[]>('/api/admin/stats/system-status').pipe(
      map((items) => items.map((item) => ({
        label: item.label,
        detail: item.detail,
        level: item.level,
        percentage: item.percentage ?? undefined,
      }))),
    );
  }

  getAiInsights(): Observable<AiInsight[]> {
    return this.http.get<{ type: string; icon: string; text: string }[]>('/api/admin/ai/insights').pipe(
      map(items => items.map(item => ({
        type: item.type as AiInsight['type'],
        icon: item.icon,
        text: item.text,
      })))
    );
  }

  sendAiMessage(message: string, history: AiChatMessage[]): Observable<AiChatResponse> {
    return this.http.post<AdminAiChatResponse>('/api/admin/ai/chat', {
      message,
      history: history.map((item) => ({
        role: item.role,
        content: item.text,
      })),
    }).pipe(
      map((response) => ({
        message: response.message,
        insights: response.insights ?? [],
      })),
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
    return parsed.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
  }

  formatTimeAgoPublic(value: string): string {
    return this.formatTimeAgo(value);
  }

  private formatTimeAgo(value: string): string {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return '';
    const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return `pre ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `pre ${hours} h`;
    const days = Math.floor(hours / 24);
    return `pre ${days} dana`;
  }

  private activityStatus(type: string): ActivityStatus {
    if (type.includes('reviewed')) return 'approved';
    if (type.includes('created') || type.includes('registered')) return 'info';
    if (type.includes('submission')) return 'pending';
    return 'info';
  }

  private activityInitials(type: string): string {
    const initials: Record<string, string> = {
      destination_created: 'DE',
      user_registered: 'KO',
      submission_created: 'ZA',
      submission_reviewed: 'OD',
      review_created: 'RE',
      notification_broadcast_sent: 'OB',
    };
    return initials[type] ?? 'AK';
  }

  private activityColor(type: string): string {
    const colors: Record<string, string> = {
      destination_created: '#28694c',
      user_registered: '#60a5fa',
      submission_created: '#d9b26f',
      submission_reviewed: '#34d399',
      review_created: '#a78bfa',
      notification_broadcast_sent: '#60a5fa',
    };
    return colors[type] ?? '#8fa896';
  }
}
