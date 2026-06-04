import { Injectable } from '@angular/core';
import { AdminRole, WidgetConfig, WidgetId } from '../models/admin.models';

const STORAGE_KEY = 'explorea_widget_config';

const DEFAULT_CONFIGS: Record<AdminRole, WidgetConfig[]> = {
  super_admin: [
    { id: 'stat-cards',    label: 'Statistike',           zone: 'main', visible: true,  order: 0, cols: 4, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, cols: 3, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'ai-panel',      label: 'AI Asistent',          zone: 'side', visible: true,  order: 2, cols: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',   zone: 'main', visible: true,  order: 3, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',          zone: 'main', visible: true,  order: 4, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'system-status', label: 'Status sistema',       zone: 'side', visible: true,  order: 5, cols: 1, roles: ['super_admin'] },
  ],
  tourist_organization: [
    { id: 'stat-cards',    label: 'Statistike',           zone: 'main', visible: true,  order: 0, cols: 4, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, cols: 3, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'ai-panel',      label: 'AI Asistent',          zone: 'side', visible: true,  order: 2, cols: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',   zone: 'main', visible: true,  order: 3, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',          zone: 'main', visible: true,  order: 4, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
  ],
  place_owner: [
    { id: 'stat-cards',    label: 'Statistike',           zone: 'main', visible: true,  order: 0, cols: 4, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, cols: 3, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',   zone: 'main', visible: true,  order: 2, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',          zone: 'main', visible: true,  order: 3, cols: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
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
        const savedAll: WidgetConfig[] = JSON.parse(raw);
        const defaults = DEFAULT_CONFIGS[role];
        const defaultsById = new Map(defaults.map(w => [w.id, w]));
        // Drop saved widgets that are no longer in defaults for this role (e.g. removed widgets)
        const saved = savedAll.filter(w => defaultsById.has(w.id));
        const savedIds = new Set(saved.map(w => w.id));
        const merged = saved.map(w => ({
          ...(defaultsById.get(w.id) ?? w),
          ...w,
          roles: defaultsById.get(w.id)?.roles ?? w.roles,
          cols: w.cols ?? defaultsById.get(w.id)?.cols ?? DEFAULT_COLS[w.id] ?? 2,
          visible: role === 'place_owner' && w.id === 'traffic-chart' && !w.roles.includes('place_owner')
            ? true
            : w.visible,
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
