import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemStatusItem } from '../../../core/models/admin.models';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-system-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './system-status.html',
  styleUrl: './system-status.css',
})
export class SystemStatus {
  @Input() items: SystemStatusItem[] = [];

  constructor(public ui: AdminUiPreferencesService) {}

  get overallLevel(): SystemStatusItem['level'] {
    if (this.items.some(item => item.level === 'critical')) return 'critical';
    if (this.items.some(item => item.level === 'warning')) return 'warning';
    return 'ok';
  }

  get overallLabel(): string {
    return {
      ok: this.ui.t('dashboard.status.ok'),
      warning: 'Upozorenje',
      critical: 'Kriticno',
    }[this.overallLevel];
  }

  get overallIcon(): string {
    return {
      ok: 'check_circle',
      warning: 'warning',
      critical: 'error',
    }[this.overallLevel];
  }

  badgeClass(level: SystemStatusItem['level']): string {
    return { ok: 'badge-success', warning: 'badge-warning', critical: 'badge-danger' }[level];
  }

  levelClass(level: SystemStatusItem['level']): string {
    return { ok: 'ok', warning: 'warning', critical: 'critical' }[level];
  }

  barColor(level: SystemStatusItem['level']): string {
    return { ok: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-danger)' }[level];
  }
}
