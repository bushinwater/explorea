// ===== ROLES =====
export type AdminRole = 'super_admin' | 'tourist_organization' | 'place_owner';

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  tourist_organization: 'Tourist Organization',
  place_owner: 'Place Owner',
};

// ===== ADMIN PROFILE =====
export interface AdminProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  profileImageUrl: string | null;
  managedRegionId: number | null;
  managedRegionName: string | null;
  countryContext: string | null;
}

// ===== WIDGET SYSTEM =====
export type WidgetId =
  | 'stat-cards'
  | 'activity-feed'
  | 'quick-actions'
  | 'traffic-chart'
  | 'system-status'
  | 'ai-panel';

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  zone: 'main' | 'side'; // kept for legacy storage compat
  visible: boolean;
  order: number;
  roles: AdminRole[];
  /** Width in 4-column units: 1=25%, 2=50%, 3=75%, 4=100% */
  cols: 1 | 2 | 3 | 4;
  /** Row index in the dashboard grid, saved after user rearranges */
  row?: number;
}

// ===== STAT CARDS =====
export interface StatCardData {
  icon: string;
  value: string;
  label: string;
  sublabel?: string;
  trend?: { value: string; up: boolean };
  color?: 'primary' | 'accent' | 'danger' | 'warning' | 'info';
}

// ===== ACTIVITY FEED =====
export type ActivityStatus = 'pending' | 'approved' | 'rejected' | 'info' | 'warning';

export interface ActivityItem {
  id: string;
  initials: string;
  avatarColor: string;
  text: string;
  timestamp: string;
  actionLabel: string;
  status: ActivityStatus;
}

// ===== QUICK ACTIONS =====
export interface QuickAction {
  id: string;
  icon: string;
  label: string;
  route: string;
  colorClass: 'primary' | 'accent' | 'info' | 'warning' | 'danger' | 'muted';
}

// ===== TRAFFIC CHART =====
export interface TrafficPoint {
  day: string;
  views: number;
}

// ===== SYSTEM STATUS =====
export type StatusLevel = 'ok' | 'warning' | 'critical';

export interface SystemStatusItem {
  label: string;
  detail: string;
  level: StatusLevel;
  percentage?: number;
}

// ===== AI PANEL =====
export interface AiInsight {
  icon: string;
  text: string;
  type: 'positive' | 'warning' | 'neutral';
}

// ===== DASHBOARD DATA (all combined per role) =====
export interface DashboardData {
  pendingCount: number;
  stats: StatCardData[];
  activity: ActivityItem[];
  quickActions: QuickAction[];
  traffic?: TrafficPoint[];
  systemStatus?: SystemStatusItem[];
  aiInsights?: AiInsight[];
}
