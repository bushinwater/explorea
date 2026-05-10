import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';

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

  constructor(public auth: DashboardAuthService) {}

  visibleTabs(): SettingsTabItem[] {
    return this.tabs.filter((tab) => !tab.superAdminOnly || this.auth.role() === 'super_admin');
  }

  setActiveTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }
}
