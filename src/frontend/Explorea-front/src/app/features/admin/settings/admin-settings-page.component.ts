import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
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
}

@Component({
  selector: 'app-admin-settings-page',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './admin-settings-page.component.html',
  styleUrl: './admin-settings-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsPageComponent implements OnInit, OnDestroy {
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

  readonly isAdministrationLoading = signal(false);
  readonly administrationErrorMessage = signal('');

  readonly toast = signal<SettingsToastState | null>(null);
  readonly tabs: SettingsTabItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      description: 'Lični podaci i status admin naloga.',
      icon: 'person',
    },
    {
      id: 'preferences',
      label: 'App Preferences',
      description: 'Izgled i ponašanje aplikacije.',
      icon: 'tune',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Podešavanja obaveštenja.',
      icon: 'notifications',
    },
    {
      id: 'administration',
      label: 'Administration',
      description: 'Sistemska podešavanja.',
      icon: 'admin_panel_settings',
      superAdminOnly: true,
    },
  ];

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

  readonly notificationChannels = [
    {
      icon: 'notifications_active',
      title: 'Push obaveštenja',
      description: 'Primaj obaveštenja o važnim promenama direktno u browseru.',
      enabled: true,
    },
    {
      icon: 'mail',
      title: 'Email obaveštenja',
      description: 'Dobijaj sažetke, potvrde i sistemske poruke putem emaila.',
      enabled: true,
    },
    {
      icon: 'campaign',
      title: 'Marketing emailovi',
      description: 'Specijalne ponude, preporuke i novosti vezane za Explorea platformu.',
      enabled: false,
    },
  ];

  readonly notificationTypes = [
    {
      icon: 'rate_review',
      title: 'Recenzije i moderacija',
      description: 'Nove recenzije, prijave korisnika i sadržaj koji čeka proveru.',
      enabled: true,
    },
    {
      icon: 'event_available',
      title: 'Događaji i aktivnosti',
      description: 'Promene statusa događaja, aktivnosti i novih zahteva organizatora.',
      enabled: true,
    },
    {
      icon: 'admin_panel_settings',
      title: 'Sistemska upozorenja',
      description: 'Bezbednosna upozorenja, promene privilegija i administrativne akcije.',
      enabled: true,
    },
    {
      icon: 'analytics',
      title: 'Nedeljni izveštaji',
      description: 'Kratak pregled performansi, aktivnosti korisnika i popularnog sadržaja.',
      enabled: false,
    },
  ];

  readonly notificationDelivery = {
    digestFrequency: 'Dnevno',
    quietHours: '22:00 - 08:00',
    priority: 'Samo važno',
  };

  readonly administrationStats = signal<AdminAdministrationStatDto[]>([
    {
      icon: 'verified_user',
      label: 'Aktivni admini',
      value: '0',
      description: 'Nalozi sa aktivnim pristupom admin panelu.',
    },
    {
      icon: 'pending_actions',
      label: 'Zahtevi na čekanju',
      value: '0',
      description: 'Objekti, recenzije i izmene koje čekaju proveru.',
    },
    {
      icon: 'security',
      label: 'Bezbednosni status',
      value: 'Učitavanje',
      description: 'Provera sistemskog statusa je u toku.',
    },
  ]);

  readonly administrationSettings = signal<AdminAdministrationSettingDto[]>([
    {
      icon: 'manage_accounts',
      title: 'Upravljanje admin ulogama',
      description: 'Superadmin može da kontroliše dozvole, regione i pristup drugim adminima.',
      actionLabel: 'Otvori korisnike',
    },
    {
      icon: 'rule',
      title: 'Pravila moderacije',
      description:
        'Podesi osnovna pravila za odobravanje destinacija, mesta, događaja i aktivnosti.',
      actionLabel: 'Podesi pravila',
    },
    {
      icon: 'database',
      title: 'Sistemski podaci',
      description:
        'Pregled osnovnih sistemskih parametara, seed podataka i administrativnih podešavanja.',
      actionLabel: 'Pregledaj sistem',
    },
  ]);

  readonly systemToggles = signal<AdminSystemToggleDto[]>([
    {
      icon: 'admin_panel_settings',
      title: 'Dozvoli registraciju novih admina',
      description: 'Kada je uključeno, novi admin nalozi mogu biti kreirani kroz admin panel.',
      enabled: false,
    },
    {
      icon: 'fact_check',
      title: 'Obavezna ručna moderacija',
      description: 'Novi korisnički sadržaj mora biti ručno odobren pre prikaza na platformi.',
      enabled: true,
    },
    {
      icon: 'history',
      title: 'Detaljan audit log',
      description: 'Pamti detaljne administrativne akcije radi bezbednosti i kasnije provere.',
      enabled: true,
    },
  ]);

  readonly dangerousActions = [
    {
      icon: 'restart_alt',
      title: 'Resetuj mock podešavanja',
      description: 'Vrati sva frontend mock podešavanja na početne vrednosti.',
    },
    {
      icon: 'delete_forever',
      title: 'Obriši test podatke',
      description: 'Akcija je prikazana samo kao UI placeholder i nije povezana sa backendom.',
    },
  ];

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
  });

  constructor(
    public auth: DashboardAuthService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly ui: AdminUiPreferencesService,
  ) {}

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

          this.ui.setTheme(preferences.theme as AdminTheme);
          this.ui.setLanguage(preferences.language as AdminLanguage);

          this.isPreferencesLoading.set(false);
        },
        error: () => {
          this.showToast('error', 'Nije moguće učitati podešavanja aplikacije.');
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

            this.showToast('success', 'Podešavanja aplikacije su uspešno sačuvana.');
            this.isPreferencesSaving.set(false);
          },
          error: () => {
            this.showToast('error', 'Nije moguće sačuvati podešavanja aplikacije.');
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
          });
          this.isNotificationsLoading.set(false);
        },
        error: () => {
          this.showToast('error', 'Nije moguće učitati podešavanja obaveštenja.');
          this.isNotificationsLoading.set(false);
        },
      }),
    );
  }

  protected updateNotificationsEnabled(enabled: boolean): void {
    this.notificationsForm.set({ notificationsEnabled: enabled });
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected resetNotificationChanges(): void {
    this.loadNotifications();
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');
  }

  protected saveNotifications(): void {
    const form = this.notificationsForm();

    this.isNotificationsSaving.set(true);
    this.notificationsSuccessMessage.set('');
    this.notificationsErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService
        .updateNotifications({
          notificationsEnabled: form.notificationsEnabled,
        })
        .subscribe({
          next: (notifications) => {
            this.notificationsForm.set({
              notificationsEnabled: notifications.notificationsEnabled,
            });
            this.showToast('success', 'Podešavanja obaveštenja su uspešno sačuvana.');
            this.isNotificationsSaving.set(false);
          },
          error: () => {
            this.notificationsErrorMessage.set('Nije moguće sačuvati podešavanja obaveštenja.');
            this.isNotificationsSaving.set(false);
          },
        }),
    );
  }

  protected themeLabel(value: string): string {
    switch (value) {
      case 'dark':
        return 'Tamna tema';
      case 'light':
        return 'Svetla tema';
      case 'system':
        return 'Sistemska tema';
      default:
        return value;
    }
  }

  protected languageLabel(value: string): string {
    switch (value) {
      case 'sr':
        return 'Srpski (SR)';
      case 'en':
        return 'English (EN)';
      default:
        return value;
    }
  }

  protected landingPageOptions() {
    return adminLandingPagesForRole(this.auth.role());
  }

  protected landingPageLabel(value: string): string {
    return normalizeAdminLandingPage(value, this.auth.role()).label;
  }

  private loadAdministration(): void {
    this.isAdministrationLoading.set(true);
    this.administrationErrorMessage.set('');

    this.subscription.add(
      this.adminSettingsService.getAdministration().subscribe({
        next: (overview) => {
          this.administrationStats.set(overview.stats);
          this.administrationSettings.set(overview.settings);
          this.systemToggles.set(overview.systemToggles);
          this.isAdministrationLoading.set(false);
        },
        error: () => {
          this.showToast('error', 'Nije moguće učitati sistemska podešavanja.');
          this.administrationErrorMessage.set('Nije moguće učitati sistemska podešavanja.');
          this.isAdministrationLoading.set(false);
        },
      }),
    );
  }

  visibleTabs(): SettingsTabItem[] {
    return this.tabs.filter((tab) => !tab.superAdminOnly || this.auth.role() === 'super_admin');
  }

  setActiveTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
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
          this.showToast('error', 'Nije moguće učitati podatke admin profila.');
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
      this.showToast('error', 'Ime, prezime i email su obavezni.');
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
            this.showToast('success', 'Profil je uspešno sačuvan.');
            this.isProfileSaving.set(false);
          },
          error: () => {
            this.showToast('error', 'Nije moguće sačuvati izmene profila.');
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

    return new Intl.DateTimeFormat('sr-Latn-RS', {
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
      this.showToast('error', 'Možeš okačiti samo sliku.');
      input.value = '';
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      this.showToast('error', 'Slika mora biti manje od 5MB.');
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
  }

  protected confirmProfilePhotoCrop(): void {
    const crop = this.lastProfilePhotoCrop;

    if (!crop) {
      this.showToast('error', 'Sacekaj da se slika pripremi za cuvanje.');
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

    this.isProfilePhotoUploading.set(true);
    this.profileErrorMessage.set('');
    this.profileSuccessMessage.set('');

    this.subscription.add(
      this.adminSettingsService.uploadProfilePhoto(file).subscribe({
        next: (profile) => {
          this.adminProfile.set(profile);
          this.resetProfileForm(profile);
          this.showToast('success', 'Profilna slika je uspešno sačuvana.');
          this.isProfilePhotoUploading.set(false);
        },
        error: () => {
          this.showToast('error', 'Nije moguće okačiti profilnu sliku.');
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
          this.showToast('success', 'Profilna slika je obrisana.');
          this.isProfilePhotoDeleting.set(false);
        },
        error: () => {
          this.showToast('error', 'Nije moguće obrisati profilnu sliku.');
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
