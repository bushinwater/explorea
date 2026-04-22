import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AdminUserStatus } from '@shared/models';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [NgClass],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: AdminUserStatus;
  @Input() label: string | null = null;

  constructor(private readonly ui: AdminUiPreferencesService) {}

  protected get badgeClass(): string {
    return `status-badge--${this.status}`;
  }

  protected get text(): string {
    return this.label ?? this.defaultLabel(this.status);
  }

  private defaultLabel(status: AdminUserStatus): string {
    return this.ui.t(`users.status.${status}`);
  }
}
