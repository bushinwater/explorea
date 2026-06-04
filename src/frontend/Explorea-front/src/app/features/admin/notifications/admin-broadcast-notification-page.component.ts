import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import {
  AdminBroadcastNotificationService,
  BroadcastRecipient,
} from './admin-broadcast-notification.service';

interface RecipientOption {
  value: BroadcastRecipient;
  label: string;
  description: string;
}

@Component({
  selector: 'app-admin-broadcast-notification-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-broadcast-notification-page.component.html',
  styleUrl: './admin-broadcast-notification-page.component.css',
})
export class AdminBroadcastNotificationPageComponent {
  protected title = '';
  protected message = '';
  protected linkUrl = '';
  protected recipient: BroadcastRecipient = 'all_users';
  protected readonly isSending = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly recipients = computed<RecipientOption[]>(() => [
    {
      value: 'all_users',
      label: this.ui.t('broadcast.recipient.all_users'),
      description: this.ui.t('broadcast.recipient.all_users_desc'),
    },
    {
      value: 'super_admins',
      label: this.ui.t('broadcast.recipient.super_admins'),
      description: this.ui.t('broadcast.recipient.super_admins_desc'),
    },
    {
      value: 'tourist_organizations',
      label: this.ui.t('broadcast.recipient.tourist_orgs'),
      description: this.ui.t('broadcast.recipient.tourist_orgs_desc'),
    },
    {
      value: 'place_owners',
      label: this.ui.t('broadcast.recipient.place_owners'),
      description: this.ui.t('broadcast.recipient.place_owners_desc'),
    },
  ]);

  constructor(
    private readonly broadcastService: AdminBroadcastNotificationService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  protected get canSend(): boolean {
    return this.title.trim().length > 0 &&
      this.message.trim().length > 0 &&
      !this.isSending();
  }

  protected send(): void {
    if (!this.canSend) return;

    this.isSending.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.broadcastService.send({
      title: this.title.trim(),
      message: this.message.trim(),
      recipient: this.recipient,
      linkUrl: this.normalizeLink(this.linkUrl),
    }).subscribe({
      next: (response) => {
        this.isSending.set(false);
        this.successMessage.set(this.ui.t('broadcast.success', { count: response.sentCount }));
        this.resetForm();
      },
      error: () => {
        this.isSending.set(false);
        this.errorMessage.set(this.ui.t('broadcast.error'));
      },
    });
  }

  private resetForm(): void {
    this.title = '';
    this.message = '';
    this.linkUrl = '';
    this.recipient = 'all_users';
  }

  private normalizeLink(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
