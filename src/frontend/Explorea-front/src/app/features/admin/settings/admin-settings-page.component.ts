import { ChangeDetectionStrategy, Component, computed, ElementRef, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { AdminProfileService } from '../core/services/admin-profile.service';
import { Subscription } from 'rxjs';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import {
  AdminAdministrationSettingDto,
  AdminAdministrationStatDto,
  AdminProfileDto,
  AdminSettingsService,
  AdminSystemToggleDto,
} from './admin-settings.service';
import {
  AdminLanguage,
  AdminTheme,
  AdminUiPreferencesService,
} from '../core/services/admin-ui-preferences.service';
import {
  adminLandingPagesForRole,
  normalizeAdminLandingPage,
} from '../core/admin-landing-pages';

type SettingsTab = 'profile' | 'preferences' | 'notifications' | 'administration';

interface SettingsToastState {
  type: 'success' | 'error';
  message: string;
}

interface AdminProfileFormState {
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  bio: string | null;
}

interface SettingsTabItem {
  id: SettingsTab;
  label: string;
  description: string;
  icon: string;
  superAdminOnly?: boolean;
}

interface AppPreferencesFormState {
  theme: string;
  language: string;
  defaultAdminPage: string;
}

interface NotificationsFormState {
  notificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  reportTopics: string[];
  priority: string;
  deliveryFrequencyDays: number;
  deliveryHour: number;
}

type NotificationChannelKey =
  | 'notificationsEnabled'
  | 'emailNotificationsEnabled'
  | 'marketingEmailsEnabled';

@Component({
  selector: 'app-admin-settings-page',
  standalone: true,
  imports: [CommonModule, RouterModule, ImageCropperComponent],
  templateUrl: './admin-settings-page.component.html',
  styleUrl: './admin-settings-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsPageComponent implements OnInit, OnDestroy {
  @ViewChild('profilePhotoInput') private profilePhotoInputRef!: ElementRef<HTMLInputElement>;

  activeTab = signal<SettingsTab>('profile');

  private readonly subscription = new Subscription();

  readonly isProfileLoading = signal(false);
  readonly profileErrorMessage = signal('');

  readonly isProfileSaving = signal(false);
  readonly profileSuccessMessage = signal('');

  readonly isProfilePhotoUploading = signal(false);
  readonly isProfilePhotoDeleting = signal(false);
  readonly isProfilePhotoCropperOpen = signal(false);
  readonly profilePhotoChangedEvent = signal<Event | null>(null);
  private lastProfilePhotoCrop: ImageCroppedEvent | null = null;

  readonly isPreferencesLoading = signal(false);
  readonly isPreferencesSaving = signal(false);
  readonly preferencesErrorMessage = signal('');
  readonly preferencesSuccessMessage = signal('');

  readonly isNotificationsLoading = signal(false);
  readonly isNotificationsSaving = signal(false);
  readonly notificationsErrorMessage = signal('');
  readonly notificationsSuccessMessage = signal('');
  readonly isTestReportSending = signal(false);
  readonly testReportResult = signal<{ ok: boolean; message: string } | null>(null);

  readonly isAdministrationLoading = signal(false);
  readonly administrationErrorMessage = signal('');
  readonly showModerationRulesModal = signal(false);

  readonly isNewsletterExporting = signal(false);

  readonly toast = signal<SettingsToastState | null>(null);
  readonly tabs = computed<SettingsTabItem[]>(() => [
    {
      id: 'profile',
      label: this.ui.t('settings.tab.profile'),
      description: this.ui.t('settings.tab.profile_desc'),
      icon: 'person',
    },
    {
      id: 'preferences',
      label: this.ui.t('settings.tab.prefs'),
      description: this.ui.t('settings.tab.prefs_desc'),
      icon: 'tune',
    },
    {
      id: 'notifications',
      label: this.ui.t('settings.tab.notif'),
      description: this.ui.t('settings.tab.notif_desc'),
      icon: 'notifications',
    },
    {
      id: 'administration',
      label: this.ui.t('settings.tab.admin'),
      description: this.ui.t('settings.tab.admin_desc'),
      icon: 'admin_panel_settings',
      superAdminOnly: true,
    },
  ]);

  readonly adminProfile = signal<AdminProfileDto>({
    id: '',
    firstName: 'Marko',
    lastName: 'Petrović',
    fullName: 'Marko Petrović',
    initials: 'MP',
    email: 'marko.p@example.rs',
    role: 'super_admin',
    roleLabel: 'Super Admin',
    region: 'Beograd, SRB',
    status: 'Active',
    memberSince: '2023-03-01T00:00:00Z',
    profileImageUrl: null,
    bio: null,
  });

  readonly notificationChannels = computed(() => [
    {
      key: 'notificationsEnabled' as NotificationChannelKey,
      icon: 'notifications_active',
      title: this.ui.t('settings.notif.channel.push'),
      description: this.ui.t('settings.notif.channel.push_desc'),
    },
    {
      key: 'emailNotificationsEnabled' as NotificationChannelKey,
      icon: 'mail',
      title: this.ui.t('settings.notif.channel.email'),
      description: this.ui.t('settings.notif.channel.email_desc'),
    },
    {
      key: 'marketingEmailsEnabled' as NotificationChannelKey,
      icon: 'campaign',
      title: this.ui.t('settings.notif.channel.marketing'),
      description: this.ui.t('settings.notif.channel.marketing_desc'),
    },
  ]);

  readonly notificationTypes = computed(() => [
    {
      value: 'reviews',
      icon: 'rate_review',
      title: this.ui.t('settings.notif.type.reviews'),
      description: this.ui.t('settings.notif.type.reviews_desc'),
    },
    {
      value: 'events',
      icon: 'event_available',
      title: this.ui.t('settings.notif.type.events'),
      description: this.ui.t('settings.notif.type.events_desc'),
    },
    {
      value: 'system',
      icon: 'admin_panel_settings',
      title: this.ui.t('settings.notif.type.system'),
      description: this.ui.t('settings.notif.type.system_desc'),
    },
    {
      value: 'weekly_summary',
      icon: 'analytics',
      title: this.ui.t('settings.notif.type.weekly_summary'),
      description: this.ui.t('settings.notif.type.weekly_summary_desc'),
    },
  ]);

  readonly notificationFrequencyOptions = computed(() => [
    { value: 1, label: this.ui.t('settings.notif.freq.daily') },
    { value: 7, label: this.ui.t('settings.notif.freq.weekly') },
    { value: 14, label: this.ui.t('settings.notif.freq.biweekly') },
    { value: 30, label: this.ui.t('settings.notif.freq.monthly') },
  ]);

  readonly notificationHourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
  }));

  readonly administrationStats = signal<AdminAdministrationStatDto[]>([]);
  readonly administrationSettings = signal<AdminAdministrationSettingDto[]>([]);
  readonly systemToggles = signal<AdminSystemToggleDto[]>([]);

  readonly profileForm = signal<AdminProfileFormState>({
    firstName: '',
    lastName: '',
    email: '',
    profileImageUrl: '',
    bio: '',
  });

  readonly preferencesForm = signal<AppPreferencesFormState>({
    theme: 'dark',
    language: 'sr',
    defaultAdminPage: 'dashboard',
  });

  readonly notificationsForm = signal<NotificationsFormState>({
    notificationsEnabled: true,
    emailNotificationsEnabled: true,
    marketingEmailsEnabled: false,
    reportTopics: ['reviews', 'events', 'system'],
    priority: 'all',
    deliveryFrequencyDays: 7,
    deliveryHour: 9,
  });

  private lastAllNotificationsReportTopics: string[] = ['reviews', 'events', 'system'];

  constructor(
    public auth: DashboardAuthService,
    private readonly adminSettingsService: AdminSettingsService,
    protected readonly ui: AdminUiPreferencesService,
    private readonly adminProfileService: AdminProfileService,
    protected readonly router: Router,
  ) {
    this.administrationStats.set([
      {
        icon: 'verified_user',
        label: this.ui.t('settings.admin.stat.active_admins.label'),
        value: '0',
        description: this.ui.t('settings.admin.stat.active_admins.desc'),
      },
      {
        icon: 'pending_actions',
        label: this.ui.t('settings.admin.stat.pending.label'),
        value: '0',
        description: this.ui.t('settings.admin.stat.pending.desc'),
      },
    ]);
    this.administrationSettings.set([
      {
        icon: 'manage_accounts',
        title: this.ui.t('settings.admin.control.roles.title'),
        description: this.ui.t('settings.admin.control.roles.desc'),
        actionLabel: this.ui.t('settings.admin.control.roles.action'),
        route: '/admin/users',
      },
      {
        icon: 'rule',
        title: this.ui.t('settings.admin.control.rules.title'),
        description: this.ui.t('settings.admin.control.rules.desc'),
        actionLabel: this.ui.t('settings.admin.control.rules.action'),
        popup: 'moderation-rules',
      },
    ]);
    this.systemToggles.set([
      {
        icon: 'history',
        title: this.ui.t('settings.admin.toggle.audit.title'),
        description: this.ui.t('settings.admin.toggle.audit.desc'),
        enabled: true,
      },
    ]);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
  ngOnInit(): void {
    this.loadProfile();
    this.loadPrefernces();
    this.loadNotifications();

    if (this.auth.role() === 'super_admin') this.loadAdministration();
  }

  private loadPrefernces(): void {
    this.isPreferencesLoading.set(true);
    this.preferencesErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService.getPreferences().subscribe({
        next: (preferences) => {
          this.preferencesForm.set({
            theme: preferences.theme,
            language: preferences.language,
            defaultAdminPage: normalizeAdminLandingPage(
              preferences.defaultAdminPage,
              this.auth.role(),
            ).value,
          });

          this.isPreferencesLoading.set(false);
        },
        error: () => {
          this.showToast('error', this.ui.t('settings.toast.prefs_load_error'));
          this.isPreferencesLoading.set(false);
        },
      }),
    );
  }

  protected updatePreferencesField(field: keyof AppPreferencesFormState, value: string): void {
    this.preferencesForm.update((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === 'theme') this.ui.setTheme(value as AdminTheme);

    if (field === 'language') this.ui.setLanguage(value as AdminLanguage);

    this.preferencesSuccessMessage.set('');
    this.preferencesErrorMessage.set('');
  }

  protected resetPreferencesChanges(): void {
    this.loadPrefernces();
    this.preferencesSuccessMessage.set('');
    this.preferencesErrorMessage.set('');
  }

  protected savePreferences(): void {
    const form = this.preferencesForm();

    this.isPreferencesSaving.set(true);
    this.preferencesSuccessMessage.set('');
    this.preferencesErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService
        .updatePreferences({
          theme: form.theme,
          language: form.language,
          defaultAdminPage: form.defaultAdminPage,
        })
        .subscribe({
          next: (preferences) => {
            this.preferencesForm.set({
              theme: preferences.theme,
              language: preferences.language,
              defaultAdminPage: normalizeAdminLandingPage(
                preferences.defaultAdminPage,
                this.auth.role(),
              ).value,
            });

            this.ui.setTheme(preferences.theme as AdminTheme);
            this.ui.setLanguage(preferences.language as AdminLanguage);

            this.showToast('success', this.ui.t('settings.toast.prefs_saved'));
            this.isPreferencesSaving.set(false);
          },
          error: () => {
            this.showToast('error', this.ui.t('settings.toast.prefs_error'));
            this.isPreferencesSaving.set(false);
          },
        }),
    );
  }

  private loadNotifications(): void {
    this.isNotificationsLoading.set(true);
    this.notificationsErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService.getNotifications().subscribe({
        next: (notifications) => {
          this.notificationsForm.set({
            notificationsEnabled: notifications.notificationsEnabled,
            emailNotificationsEnabled: notifications.emailNotificationsEnabled,
            marketingEmailsEnabled: notifications.marketingEmailsEnabled,
            reportTopics: this.normalizeReportTopics(notifications.reportTopics),
            priority: this.normalizeNotificationPriority(notifications.priority),
            deliveryFrequencyDays: this.normalizeDeliveryFrequencyDays(
              notifications.deliveryFrequencyDays,
            ),
            deliveryHour: this.normalizeDeliveryHour(notifications.deliveryHour),
          });
          this.rememberAllNotificationsReportTopics(this.notificationsForm().reportTopics);
          this.isNotificationsLoading.set(false);
        },
        error: () => {
          this.showToast('error', this.ui.t('settings.toast.notif_load_error'));
          this.isNotificationsLoading.set(false);
        },
      }),
    );
  }

  protected updateNotificationsEnabled(enabled: boolean): void {
    this.updateNotificationChannel('notificationsEnabled', enabled);
  }

  protected updateNotificationChannel(field: NotificationChannelKey, enabled: boolean): void {
    this.notificationsForm.update((current) => ({
      ...current,
      [field]: enabled,
    }));
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected isReportTopicSelected(topic: string): boolean {
    return this.notificationsForm().priority !== 'important'
      && this.notificationsForm().reportTopics.includes(topic);
  }

  protected toggleReportTopic(topic: string): void {
    if (this.notificationsForm().priority === 'important') return;

    this.notificationsForm.update((current) => {
      const isSelected = current.reportTopics.includes(topic);
      let reportTopics = isSelected
        ? current.reportTopics.filter((item) => item !== topic)
        : [...current.reportTopics.filter((item) => item !== 'weekly_summary'), topic];

      if (topic === 'weekly_summary' && !isSelected) {
        reportTopics = ['weekly_summary'];
      }

      return {
        ...current,
        reportTopics: this.normalizeReportTopics(reportTopics),
      };
    });

    this.rememberAllNotificationsReportTopics(this.notificationsForm().reportTopics);
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected updateNotificationPriority(priority: string): void {
    const normalizedPriority = this.normalizeNotificationPriority(priority);

    this.notificationsForm.update((current) => {
      if (normalizedPriority === 'important') {
        this.rememberAllNotificationsReportTopics(current.reportTopics);

        return {
          ...current,
          priority: normalizedPriority,
          reportTopics: [],
        };
      }

      return {
        ...current,
        priority: normalizedPriority,
        reportTopics: this.lastAllNotificationsReportTopics,
      };
    });

    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected updateDeliveryFrequency(days: string): void {
    this.notificationsForm.update((current) => ({
      ...current,
      deliveryFrequencyDays: this.normalizeDeliveryFrequencyDays(Number(days)),
    }));

    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected updateDeliveryHour(hour: string): void {
    this.notificationsForm.update((current) => ({
      ...current,
      deliveryHour: this.normalizeDeliveryHour(Number(hour)),
    }));

    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected resetNotificationChanges(): void {
    this.loadNotifications();
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected onSettingAction(setting: AdminAdministrationSettingDto): void {
    if (setting.popup === 'moderation-rules') {
      this.showModerationRulesModal.set(true);
    } else if (setting.route) {
      this.router.navigate([setting.route]);
    }
  }

  protected closeModerationRulesModal(): void {
    this.showModerationRulesModal.set(false);
  }

  protected sendTestReport(): void {
    this.isTestReportSending.set(true);
    this.testReportResult.set(null);

    // Save the current form first so the report uses the user's latest selection
    // (frequency, topics, priority, hour). Otherwise the previously saved values
    // are used, which can mislead the user.
    const form = this.notificationsForm();
    const priority = this.normalizeNotificationPriority(form.priority);
    this.subscription.add(
      this.adminSettingsService
        .updateNotifications({
          notificationsEnabled: form.notificationsEnabled,
          emailNotificationsEnabled: form.emailNotificationsEnabled,
          marketingEmailsEnabled: form.marketingEmailsEnabled,
          reportTopics: priority === 'important'
            ? this.lastAllNotificationsReportTopics
            : this.normalizeReportTopics(form.reportTopics),
          priority,
          deliveryFrequencyDays: this.normalizeDeliveryFrequencyDays(form.deliveryFrequencyDays),
          deliveryHour: this.normalizeDeliveryHour(form.deliveryHour),
        })
        .subscribe({
          next: () => {
            this.subscription.add(
              this.adminSettingsService.forceSendReport().subscribe({
                next: (result) => {
                  this.isTestReportSending.set(false);
                  this.testReportResult.set({
                    ok: true,
                    message: result.sentCount > 0
                      ? this.ui.t('settings.toast.report_sent')
                      : this.ui.t('settings.toast.report_empty'),
                  });
                },
                error: () => {
                  this.isTestReportSending.set(false);
                  this.testReportResult.set({ ok: false, message: this.ui.t('settings.toast.report_error') });
                },
              }),
            );
          },
          error: () => {
            this.isTestReportSending.set(false);
            this.testReportResult.set({ ok: false, message: this.ui.t('settings.toast.report_error') });
          },
        }),
    );
  }

  protected saveNotifications(): void {
    const form = this.notificationsForm();
    const priority = this.normalizeNotificationPriority(form.priority);

    this.isNotificationsSaving.set(true);
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService
        .updateNotifications({
          notificationsEnabled: form.notificationsEnabled,
          emailNotificationsEnabled: form.emailNotificationsEnabled,
          marketingEmailsEnabled: form.marketingEmailsEnabled,
          reportTopics: priority === 'important'
            ? this.lastAllNotificationsReportTopics
            : this.normalizeReportTopics(form.reportTopics),
          priority,
          deliveryFrequencyDays: this.normalizeDeliveryFrequencyDays(form.deliveryFrequencyDays),
          deliveryHour: this.normalizeDeliveryHour(form.deliveryHour),
        })
        .subscribe({
          next: (notifications) => {
            this.notificationsForm.set({
              notificationsEnabled: notifications.notificationsEnabled,
              emailNotificationsEnabled: notifications.emailNotificationsEnabled,
              marketingEmailsEnabled: notifications.marketingEmailsEnabled,
              reportTopics: this.normalizeReportTopics(notifications.reportTopics),
              priority: this.normalizeNotificationPriority(notifications.priority),
              deliveryFrequencyDays: this.normalizeDeliveryFrequencyDays(
                notifications.deliveryFrequencyDays,
              ),
              deliveryHour: this.normalizeDeliveryHour(notifications.deliveryHour),
            });
            this.rememberAllNotificationsReportTopics(this.notificationsForm().reportTopics);
            this.showToast('success', this.ui.t('settings.toast.notif_saved'));
            this.isNotificationsSaving.set(false);
          },
          error: () => {
            this.notificationsErrorMessage.set(this.ui.t('settings.toast.notif_error'));
            this.isNotificationsSaving.set(false);
          },
        }),
    );
  }

  protected themeLabel(value: string): string {
    switch (value) {
      case 'dark': return this.ui.t('settings.prefs.theme_dark');
      case 'light': return this.ui.t('settings.prefs.theme_light');
      case 'system': return this.ui.t('settings.prefs.theme_system');
      default: return value;
    }
  }

  protected languageLabel(value: string): string {
    switch (value) {
      case 'sr': return this.ui.t('settings.prefs.language_sr');
      case 'en': return this.ui.t('settings.prefs.language_en');
      default: return value;
    }
  }

  protected landingPageOptions() {
    return adminLandingPagesForRole(this.auth.role());
  }

  protected landingPageLabel(value: string): string {
    return this.ui.t(normalizeAdminLandingPage(value, this.auth.role()).labelKey);
  }

  private normalizeReportTopics(topics: string[]): string[] {
    const allowedTopics = ['reviews', 'events', 'system', 'weekly_summary'];
    const normalized = topics.filter((topic, index) =>
      allowedTopics.includes(topic) && topics.indexOf(topic) === index);

    return normalized.includes('weekly_summary') ? ['weekly_summary'] : normalized;
  }

  private rememberAllNotificationsReportTopics(topics: string[]): void {
    const normalizedTopics = this.normalizeReportTopics(topics);

    if (normalizedTopics.length > 0) {
      this.lastAllNotificationsReportTopics = normalizedTopics;
    }
  }

  private normalizeNotificationPriority(priority: string): string {
    return priority === 'important' ? 'important' : 'all';
  }

  private normalizeDeliveryFrequencyDays(days: number): number {
    return [1, 7, 14, 30].includes(days) ? days : 7;
  }

  private normalizeDeliveryHour(hour: number): number {
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9;
  }

  private loadAdministration(): void {
    this.isAdministrationLoading.set(true);
    this.administrationErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService.getAdministration().subscribe({
        next: (overview) => {
          this.administrationStats.set(overview.stats);
          const localActions = this.administrationSettings().map((s) => ({ route: s.route, popup: s.popup }));
          const merged = overview.settings.map((s, i) => ({ ...s, ...localActions[i] }));
          this.administrationSettings.set(merged);
          this.systemToggles.set(overview.systemToggles);
          this.isAdministrationLoading.set(false);
        },
        error: () => {
          this.showToast('error', this.ui.t('settings.toast.admin_load_error'));
          this.administrationErrorMessage.set(this.ui.t('settings.toast.admin_load_error'));
          this.isAdministrationLoading.set(false);
        },
      }),
    );
  }

  exportNewsletterEmails(): void {
    if (this.isNewsletterExporting()) return;
    this.isNewsletterExporting.set(true);
    this.adminSettingsService.exportNewsletterEmails().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'newsletter-subscribers.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.isNewsletterExporting.set(false);
      },
      error: () => {
        this.showToast('error', this.ui.t('settings.toast.newsletter_error'));
        this.isNewsletterExporting.set(false);
      },
    });
  }

  visibleTabs(): SettingsTabItem[] {
    return this.tabs().filter((tab) => !tab.superAdminOnly || this.auth.role() === 'super_admin');
  }

  setActiveTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    if (tab === 'administration' && this.auth.role() === 'super_admin') {
      this.loadAdministration();
    }
  }

  private loadProfile(): void {
    this.isProfileLoading.set(true);
    this.profileErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService.getProfile().subscribe({
        next: (profile) => {
          this.adminProfile.set(profile);
          this.resetProfileForm(profile);
          this.isProfileLoading.set(false);
        },
        error: () => {
          this.showToast('error', this.ui.t('settings.toast.profile_load_error'));
          this.isProfileLoading.set(false);
        },
      }),
    );
  }

  protected updateProfileField(field: keyof AdminProfileFormState, value: string): void {
    this.profileForm.update((current) => ({
      ...current,
      [field]: field === 'profileImageUrl' && !value.trim() ? null : value,
    }));

    this.profileSuccessMessage.set('');
    this.profileErrorMessage.set('');
  }

  protected resetProfileChanges(): void {
    this.resetProfileForm(this.adminProfile());
    this.profileSuccessMessage.set('');
    this.profileErrorMessage.set('');
  }

  protected saveProfile(): void {
    const form = this.profileForm();

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      this.showToast('error', this.ui.t('settings.toast.profile_required'));
      return;
    }

    this.isProfileSaving.set(true);
    this.profileErrorMessage.set('');
    this.profileSuccessMessage.set('');

    this.subscription.add(
      this.adminSettingsService
        .updateProfile({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          profileImageUrl: form.profileImageUrl,
          bio: form.bio?.trim() || null,
        })
        .subscribe({
          next: (profile) => {
            this.adminProfile.set(profile);
            this.resetProfileForm(profile);
            this.adminProfileService.patch({
              firstName: profile.firstName,
              lastName: profile.lastName,
              profileImageUrl: profile.profileImageUrl,
            });
            this.showToast('success', this.ui.t('settings.toast.profile_saved'));
            this.isProfileSaving.set(false);
          },
          error: () => {
            this.showToast('error', this.ui.t('settings.toast.profile_error'));
            this.isProfileSaving.set(false);
          },
        }),
    );
  }

  private resetProfileForm(profile: AdminProfileDto): void {
    this.profileForm.set({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      profileImageUrl: profile.profileImageUrl,
      bio: profile.bio ?? '',
    });
  }

  protected formattedMemberSince(): string {
    const value = this.adminProfile().memberSince;

    if (!value) return 'N/A';

    const date = new Date(value);

    if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1) return 'N/A';

    const locale = this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('error', this.ui.t('settings.toast.image_type_error'));
      input.value = '';
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      this.showToast('error', this.ui.t('settings.toast.image_size_error'));
      input.value = '';
      return;
    }

    this.profilePhotoChangedEvent.set(event);
    this.lastProfilePhotoCrop = null;
    this.isProfilePhotoCropperOpen.set(true);
  }

  protected onProfilePhotoCropped(event: ImageCroppedEvent): void {
    this.lastProfilePhotoCrop = event;
  }

  protected cancelProfilePhotoCrop(): void {
    this.isProfilePhotoCropperOpen.set(false);
    this.profilePhotoChangedEvent.set(null);
    this.lastProfilePhotoCrop = null;
    this.profilePhotoInputRef.nativeElement.value = '';
  }

  protected confirmProfilePhotoCrop(): void {
    const crop = this.lastProfilePhotoCrop;

    if (!crop) {
      this.showToast('error', this.ui.t('settings.toast.photo_wait'));
      return;
    }

    if (crop.blob) {
      this.uploadProfilePhoto(new File([crop.blob], 'admin-avatar.jpg', { type: 'image/jpeg' }));
      return;
    }

    if (crop.base64) {
      const base64 = crop.base64.split(',')[1] ?? crop.base64;
      const bytes = atob(base64);
      const buffer = new ArrayBuffer(bytes.length);
      const view = new Uint8Array(buffer);

      for (let index = 0; index < bytes.length; index += 1) {
        view[index] = bytes.charCodeAt(index);
      }

      this.uploadProfilePhoto(new File([buffer], 'admin-avatar.jpg', { type: 'image/jpeg' }));
    }
  }

  private uploadProfilePhoto(file: File): void {
    this.isProfilePhotoCropperOpen.set(false);
    this.profilePhotoChangedEvent.set(null);
    this.lastProfilePhotoCrop = null;
    this.profilePhotoInputRef.nativeElement.value = '';

    this.isProfilePhotoUploading.set(true);
    this.adminProfileService.isPhotoUploading.set(true);
    this.profileErrorMessage.set('');
    this.profileSuccessMessage.set('');

    this.subscription.add(
      this.adminSettingsService.uploadProfilePhoto(file).subscribe({
        next: (profile) => {
          this.adminProfile.set(profile);
          this.resetProfileForm(profile);
          this.adminProfileService.patch({ profileImageUrl: profile.profileImageUrl });
          this.adminProfileService.isPhotoUploading.set(false);
          this.showToast('success', this.ui.t('settings.toast.photo_saved'));
          this.isProfilePhotoUploading.set(false);
        },
        error: () => {
          this.adminProfileService.isPhotoUploading.set(false);
          this.showToast('error', this.ui.t('settings.toast.photo_error'));
          this.isProfilePhotoUploading.set(false);
        },
      }),
    );
  }

  protected deleteProfilePhoto(): void {
    if (!this.adminProfile().profileImageUrl) {
      return;
    }

    this.isProfilePhotoDeleting.set(true);
    this.profileErrorMessage.set('');
    this.profileSuccessMessage.set('');

    this.subscription.add(
      this.adminSettingsService.deleteProfilePhoto().subscribe({
        next: (profile) => {
          this.adminProfile.set(profile);
          this.resetProfileForm(profile);
          this.adminProfileService.patch({ profileImageUrl: profile.profileImageUrl });
          this.showToast('success', this.ui.t('settings.toast.photo_deleted'));
          this.isProfilePhotoDeleting.set(false);
        },
        error: () => {
          this.showToast('error', this.ui.t('settings.toast.photo_delete_error'));
          this.isProfilePhotoDeleting.set(false);
        },
      }),
    );
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });

    window.setTimeout(() => {
      this.toast.set(null);
    }, 3500);
  }

  protected closeToast(): void {
    this.toast.set(null);
  }
}
