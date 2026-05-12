import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { descriptors } from 'node_modules/chart.js/dist/core/core.defaults';
import { Subscription } from 'rxjs';
import { AdminProfileDto, AdminSettingsService } from './admin-settings.service';

type SettingsTab = 'profile' | 'preferences' | 'notifications' | 'administration';

interface AdminProfileFormState {
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
}

interface SettingsTabItem {
  id: SettingsTab;
  label: string;
  description: string;
  icon: string;
  superAdminOnly?: boolean;
}

@Component({
  selector: 'app-admin-settings-page',
  standalone: true,
  imports: [CommonModule],
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
  });

  readonly appPreferences = {
    language: 'Srpski (SR)',
    theme: 'Tamna tema',
    landingPage: 'Dashboard',
    sidebarMode: 'Kompaktan prikaz',
    dateFormat: 'DD.MM.YYYY',
    accentColor: 'Explorea zelena',
  };

  readonly behaviorPreferences = [
    {
      icon: 'dashboard_customize',
      title: 'Kompaktan sidebar',
      description: 'Prikaži samo ikonice dok se navigacija ne proširi.',
      enabled: true,
    },
    {
      icon: 'table_rows',
      title: 'Gusti prikaz tabela',
      description: 'Prikaži više redova u admin tabelama sa manjim razmacima.',
      enabled: false,
    },
    {
      icon: 'bolt',
      title: 'Brze akcije',
      description: 'Prikaži najčešće admin akcije odmah na vrhu stranica.',
      enabled: true,
    },
  ];

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

  readonly administrationStats = [
    {
      icon: 'verified_user',
      label: 'Aktivni admini',
      value: '12',
      description: 'Nalozi sa aktivnim pristupom admin panelu.',
    },
    {
      icon: 'pending_actions',
      label: 'Zahtevi na čekanju',
      value: '24',
      description: 'Objekti, recenzije i izmene koje čekaju proveru.',
    },
    {
      icon: 'security',
      label: 'Bezbednosni status',
      value: 'Stabilno',
      description: 'Nema kritičnih upozorenja u poslednja 24h.',
    },
  ];

  readonly administrationSettings = [
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
  ];

  readonly systemToggles = [
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
  ];

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
  });

  constructor(
    public auth: DashboardAuthService,
    private readonly adminSettingsService: AdminSettingsService,
  ) {}

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
  ngOnInit(): void {
    this.loadProfile();
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
          this.profileErrorMessage.set('Nije moguće učitati podatke admin profila.');
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
      this.profileErrorMessage.set('Ime, prezime i email su obavezni.');
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
        })
        .subscribe({
          next: (profile) => {
            this.adminProfile.set(profile);
            this.resetProfileForm(profile);
            this.profileSuccessMessage.set('Profil je uspešno sačuvan.');
            this.isProfileSaving.set(false);
          },
          error: () => {
            this.profileErrorMessage.set('Nije moguće sačuvati izmene profila.');
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
}
