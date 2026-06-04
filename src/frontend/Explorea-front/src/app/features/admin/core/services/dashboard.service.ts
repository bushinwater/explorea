import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AdminRole, DashboardData, TrafficPoint, SystemStatusItem,
  AiInsight, AiChatMessage, AiChatResponse, AiQuickAction, QuickAction,
  StatCardData, ActivityItem, ActivityStatus,
} from '../models/admin.models';
import { Observable, map } from 'rxjs';
import { AdminUiPreferencesService } from './admin-ui-preferences.service';

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
  detailKey?: string | null;
  level: 'ok' | 'warning' | 'critical';
  percentage?: number | null;
}

interface AdminPendingCount {
  count: number;
  eventCount: number;
  placeCount: number;
}

interface AdminAiChatResponse {
  message: string;
  insights: AiInsight[];
  quickActions?: AiQuickAction[];
}

const QUICK_ACTION_KEYS: Record<AdminRole, (Omit<QuickAction, 'label'> & { labelKey: string })[]> = {
  super_admin: [
    { id: 'add-dest',   icon: 'add_location_alt', labelKey: 'dashboard.quickaction.add_dest',   route: '/admin/destinations?create=true', colorClass: 'primary' },
    { id: 'users',      icon: 'people',           labelKey: 'dashboard.quickaction.users',       route: '/admin/users',                   colorClass: 'info'    },
    { id: 'activities', icon: 'hiking',           labelKey: 'dashboard.quickaction.activities',  route: '/admin/activities',              colorClass: 'warning' },
    { id: 'broadcast',  icon: 'campaign',         labelKey: 'dashboard.quickaction.broadcast',   route: '/admin/notifications/broadcast', colorClass: 'accent'  },
  ],
  tourist_organization: [
    { id: 'add-event', icon: 'event_available', labelKey: 'dashboard.quickaction.add_event', route: '/admin/events?create=true', colorClass: 'primary' },
    { id: 'profile',   icon: 'manage_accounts',  labelKey: 'dashboard.quickaction.profile_settings', route: '/admin/settings',          colorClass: 'muted'   },
    { id: 'reviews',   icon: 'rate_review',     labelKey: 'dashboard.quickaction.reviews',   route: '/admin/reviews',           colorClass: 'warning' },
    { id: 'report',    icon: 'assessment',      labelKey: 'dashboard.quickaction.report',    route: '/admin/reports',           colorClass: 'info'    },
  ],
  place_owner: [
    { id: 'add-place', icon: 'add_business',    labelKey: 'dashboard.quickaction.add_place',  route: '/admin/places?create=true', colorClass: 'primary' },
    { id: 'add-event', icon: 'event_available', labelKey: 'dashboard.quickaction.add_event',  route: '/admin/events?create=true', colorClass: 'info'    },
    { id: 'reviews',   icon: 'rate_review',     labelKey: 'dashboard.quickaction.my_reviews', route: '/admin/reviews',            colorClass: 'accent'  },
    { id: 'support',   icon: 'support',         labelKey: 'dashboard.quickaction.support',    route: '/admin/support',            colorClass: 'muted'   },
  ],
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly ui = inject(AdminUiPreferencesService);

  getQuickActions(role: AdminRole): QuickAction[] {
    return (QUICK_ACTION_KEYS[role] ?? []).map(a => ({
      ...a,
      label: this.ui.t(a.labelKey),
    }));
  }

  getPendingCount(): Observable<AdminPendingCount> {
    return this.http.get<AdminPendingCount>('/api/admin/stats/pending-count');
  }

  getOverviewStats(role: AdminRole): Observable<StatCardData[]> {
    return this.http.get<AdminStatsOverview>('/api/admin/stats/overview').pipe(
      map((overview) => [
        {
          icon: role === 'place_owner' ? 'storefront' : 'people',
          value: this.formatNumber(overview.totalUsers),
          label: this.ui.t('dashboard.stats.total_users'),
          sublabel: this.ui.t('dashboard.stats.new_users_hint', { count: this.formatNumber(overview.newUsersLast30Days) }),
          color: 'primary',
        },
        {
          icon: role === 'place_owner' ? 'add_business' : 'person_add',
          value: this.formatNumber(overview.newUsersLast30Days),
          label: this.ui.t('dashboard.stats.new_users_label'),
          sublabel: this.ui.t('dashboard.stats.last_30d'),
          color: 'info',
        },
        {
          icon: role === 'place_owner' ? 'verified' : 'location_on',
          value: this.formatNumber(overview.activeDestinations),
          label: this.ui.t(role === 'place_owner' ? 'dashboard.stats.active_entries' : 'dashboard.stats.active_dest'),
          sublabel: overview.mostPopularDestination
            ? this.ui.t(role === 'place_owner' ? 'dashboard.stats.owner_most_popular_dest' : 'dashboard.stats.most_popular_dest', { name: overview.mostPopularDestination.name })
            : this.ui.t(role === 'place_owner' ? 'dashboard.stats.owner_no_dest_views' : 'dashboard.stats.no_dest_views'),
          color: 'warning',
        },
        {
          icon: 'trending_up',
          value: overview.mostPopularEntity?.name ?? this.ui.t('dashboard.stats.no_entity'),
          label: this.ui.t(role === 'place_owner' ? 'dashboard.stats.owner_popular_entity' : 'dashboard.stats.popular_entity'),
          sublabel: overview.mostPopularEntity
            ? this.ui.t('dashboard.stats.entity_views', {
                type: this.entityTypeLabel(overview.mostPopularEntity.entityType),
                views: this.formatNumber(overview.mostPopularEntity.views),
              })
            : this.ui.t('dashboard.stats.no_views'),
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
        text: this.translateActivityText(item.type, item.description),
        timestamp: this.formatTimeAgo(item.createdAt),
        actionLabel: this.ui.t('dashboard.activity.details'),
        status: this.activityStatus(item.type),
      }))),
    );
  }

  private translateActivityText(type: string, description: string): string {
    // Backend sends Serbian descriptions like "Objekat kreiran: NAME" or
    // "Nova recenzija (5/5) na vasem objektu". Use translation key based on
    // type and extract the entity name when present.
    const key = `dashboard.feed.types.${type}`;
    const translated = this.ui.t(key);
    if (translated === key) return description; // no translation defined → fall back
    const colonIdx = description.lastIndexOf(': ');
    if (colonIdx >= 0) {
      const name = description.slice(colonIdx + 2);
      return `${translated}: ${name}`;
    }
    return translated;
  }

  getSystemStatus(): Observable<SystemStatusItem[]> {
    return this.http.get<AdminSystemStatusItem[]>('/api/admin/stats/system-status').pipe(
      map((items) => items.map((item) => ({
        label: this.ui.t(item.label),
        detail: item.detailKey ? this.ui.t(item.detailKey, { count: item.detail }) : this.ui.t(item.detail),
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
        quickActions: response.quickActions ?? [],
      })),
    );
  }

  private get dateLocale(): string { return this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS'; }

  private formatNumber(value: number): string {
    return value.toLocaleString(this.dateLocale);
  }

  private entityTypeLabel(entityType: string): string {
    const keyMap: Record<string, string> = {
      destination: 'dashboard.entity.destination',
      place:       'dashboard.entity.place',
      event:       'dashboard.entity.event',
      activity:    'dashboard.entity.activity',
    };
    return this.ui.t(keyMap[entityType] ?? entityType);
  }

  private formatTrafficDate(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(this.dateLocale, { day: '2-digit', month: '2-digit' });
  }

  formatTimeAgoPublic(value: string): string {
    return this.formatTimeAgo(value);
  }

  private formatTimeAgo(value: string): string {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return '';
    const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return this.ui.t('dashboard.time.minutes_ago', { value: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.ui.t('dashboard.time.hours_ago', { value: hours });
    const days = Math.floor(hours / 24);
    return this.ui.t('dashboard.time.days_ago', { value: days });
  }

  private activityStatus(type: string): ActivityStatus {
    if (type === 'submission_approved' || type.includes('reviewed')) return 'approved';
    if (type === 'submission_rejected') return 'rejected';
    if (type.includes('created') || type.includes('registered')) return 'info';
    if (type.includes('submission')) return 'pending';
    return 'info';
  }

  private activityInitials(type: string): string {
    const initials: Record<string, string> = {
      destination_created:         'DE',
      user_registered:             'KO',
      submission_created:          'ZA',
      submission_reviewed:         'OD',
      submission_approved:         'OD',
      submission_rejected:         'OD',
      review_created:              'RE',
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
