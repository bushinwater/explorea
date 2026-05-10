import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { descriptors } from 'node_modules/chart.js/dist/core/core.defaults';

type SettingsTab = 'profile' | 'preferences' | 'notifications' | 'administration';

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
export class AdminSettingsPageComponent {
  activeTab = signal<SettingsTab>('profile');

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

  readonly adminProfile = {
    firstName: 'Marko',
    lastName: 'Petrović',
    fullName: 'Marko Petrović',
    initials: 'MP',
    username: 'marko_petrovic',
    email: 'marko.p@example.rs',
    role: 'Super Admin',
    region: 'Beograd, SRB',
    status: 'Active',
    bio: 'Upravlja Explorea administracijom, moderacijom sadržaja i sistemskim podešavanjima.',
    joinedAt: 'Mart 2023.',
  };

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

  constructor(public auth: DashboardAuthService) {}

  visibleTabs(): SettingsTabItem[] {
    return this.tabs.filter((tab) => !tab.superAdminOnly || this.auth.role() === 'super_admin');
  }

  setActiveTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }
}
