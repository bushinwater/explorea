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

  levelClass(level: SystemStatusItem['level']): string {
    return { ok: 'ok', warning: 'warning', critical: 'critical' }[level];
  }

  barColor(level: SystemStatusItem['level']): string {
    return { ok: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-danger)' }[level];
  }
}
