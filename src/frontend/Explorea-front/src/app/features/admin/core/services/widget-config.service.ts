import { Injectable } from '@angular/core';
import { AdminRole, WidgetConfig, WidgetId } from '../models/admin.models';

const STORAGE_KEY = 'explorea_widget_config';

const DEFAULT_CONFIGS: Record<AdminRole, WidgetConfig[]> = {
  super_admin: [
    { id: 'stat-cards',    label: 'Statistike',          zone: 'main', visible: true,  order: 0, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',  zone: 'main', visible: true,  order: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',         zone: 'main', visible: true,  order: 3, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'ai-panel',      label: 'AI Asistent',         zone: 'side', visible: true,  order: 0, roles: ['super_admin', 'tourist_organization'] },
    { id: 'system-status', label: 'Status sistema',      zone: 'side', visible: true,  order: 1, roles: ['super_admin'] },
  ],
  tourist_organization: [
    { id: 'stat-cards',    label: 'Statistike',          zone: 'main', visible: true,  order: 0, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: true,  order: 1, roles: ['super_admin', 'tourist_organization'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',  zone: 'main', visible: true,  order: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',         zone: 'main', visible: true,  order: 3, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'ai-panel',      label: 'AI Asistent',         zone: 'side', visible: true,  order: 0, roles: ['super_admin', 'tourist_organization'] },
    { id: 'system-status', label: 'Status sistema',      zone: 'side', visible: false, order: 1, roles: ['super_admin'] },
  ],
  place_owner: [
    { id: 'stat-cards',    label: 'Statistike',          zone: 'main', visible: true,  order: 0, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'activity-feed', label: 'Nedavne aktivnosti',  zone: 'main', visible: true,  order: 1, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'quick-actions', label: 'Brze akcije',         zone: 'main', visible: true,  order: 2, roles: ['super_admin', 'tourist_organization', 'place_owner'] },
    { id: 'traffic-chart', label: 'Analitika saobraćaja', zone: 'main', visible: false, order: 3, roles: ['super_admin', 'tourist_organization'] },
    { id: 'ai-panel',      label: 'AI Asistent',         zone: 'side', visible: false, order: 0, roles: ['super_admin', 'tourist_organization'] },
    { id: 'system-status', label: 'Status sistema',      zone: 'side', visible: false, order: 1, roles: ['super_admin'] },
  ],
};

@Injectable({ providedIn: 'root' })
export class WidgetConfigService {
  load(role: AdminRole): WidgetConfig[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${role}`);
      if (raw) {
        const saved: WidgetConfig[] = JSON.parse(raw);
        // Merge with defaults to handle new widgets added later
        const defaults = DEFAULT_CONFIGS[role];
        const savedIds = new Set(saved.map(w => w.id));
        const merged = [...saved];
        for (const def of defaults) {
          if (!savedIds.has(def.id)) merged.push(def);
        }
        return merged.sort((a, b) => {
          if (a.zone !== b.zone) return a.zone === 'main' ? -1 : 1;
          return a.order - b.order;
        });
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

  isVisible(config: WidgetConfig[], id: WidgetId, role: AdminRole): boolean {
    const w = config.find(c => c.id === id);
    return !!(w && w.visible && w.roles.includes(role));
  }
}
