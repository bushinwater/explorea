import { Injectable } from '@angular/core';
import { AdminRole, WidgetConfig, WidgetId } from '../models/admin.models';

const STORAGE_KEY = 'explorea_widget_config';

const DEFAULT_CONFIGS: Record<AdminRole, WidgetConfig[]> = {
  super_admin: [
    { id: 'stat-cards',    label: 'Statistike',           zone: 'main', visible: true,  order: 0, cols: 4, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, cols: 3, roles: ['super_admin', 'tourist_organization'] },
    { id: 'ai-panel',      label: 'AI Asistent',          zone: 'side', visible: true,  order: 2, cols: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',   zone: 'main', visible: true,  order: 3, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',          zone: 'main', visible: true,  order: 4, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'system-status', label: 'Status sistema',       zone: 'side', visible: true,  order: 5, cols: 1, roles: ['super_admin'] },
  ],
  tourist_organization: [
    { id: 'stat-cards',    label: 'Statistike',           zone: 'main', visible: true,  order: 0, cols: 4, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, cols: 3, roles: ['super_admin', 'tourist_organization'] },
    { id: 'ai-panel',      label: 'AI Asistent',          zone: 'side', visible: true,  order: 2, cols: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',   zone: 'main', visible: true,  order: 3, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',          zone: 'main', visible: true,  order: 4, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'system-status', label: 'Status sistema',       zone: 'side', visible: false, order: 5, cols: 1, roles: ['super_admin'] },
  ],
  place_owner: [
    { id: 'stat-cards',    label: 'Statistike',           zone: 'main', visible: true,  order: 0, cols: 4, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',   zone: 'main', visible: true,  order: 1, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',          zone: 'main', visible: true,  order: 2, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: false, order: 3, cols: 3, roles: ['super_admin', 'tourist_organization'] },
    { id: 'ai-panel',      label: 'AI Asistent',          zone: 'side', visible: false, order: 4, cols: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'system-status', label: 'Status sistema',       zone: 'side', visible: false, order: 5, cols: 1, roles: ['super_admin'] },
  ],
};

const DEFAULT_COLS: Record<WidgetId, 1 | 2 | 3 | 4> = {
  'stat-cards':    4,
  'traffic-chart': 3,
  'ai-panel':      1,
  'activity-feed': 2,
  'quick-actions': 2,
  'system-status': 1,
};

@Injectable({ providedIn: 'root' })
export class WidgetConfigService {
  load(role: AdminRole): WidgetConfig[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${role}`);
      if (raw) {
        const saved: WidgetConfig[] = JSON.parse(raw);
        const defaults = DEFAULT_CONFIGS[role];
        const savedIds = new Set(saved.map(w => w.id));
        const merged = saved.map(w => ({
          ...w,
          cols: w.cols ?? DEFAULT_COLS[w.id] ?? 2,
        }));
        for (const def of defaults) {
          if (!savedIds.has(def.id)) merged.push(def);
        }
        return merged.sort((a, b) => a.order - b.order);
      }
    } catch { /* ignore */ }
    return [...DEFAULT_CONFIGS[role]];
  }

  save(role: AdminRole, config: WidgetConfig[]): void {
    localStorage.setItem(`${STORAGE_KEY}_${role}`, JSON.stringify(config));
  }

  reset(role: AdminRole): WidgetConfig[] {
    localStorage.removeItem(`${STORAGE_KEY}_${role}`);
    return [...DEFAULT_CONFIGS[role]];
  }
}
