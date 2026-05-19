import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DashboardAuthService } from '../../core/services/dashboard-auth.service';
import { AdminUiPreferencesService } from '../../core/services/admin-ui-preferences.service';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminRole } from '../../core/models/admin.models';

interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  roles: AdminRole[];
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'dashboard',      labelKey: 'sidebar.dashboard',    route: '/admin/dashboard',    roles: ['super_admin', 'tourist_organization', 'place_owner'] },
  { icon: 'map',            labelKey: 'sidebar.map',          route: '/admin/map-view',     roles: ['super_admin', 'tourist_organization'] },
  { icon: 'location_on',    labelKey: 'sidebar.destinations', route: '/admin/destinations', roles: ['super_admin', 'tourist_organization'] },
  { icon: 'event',          labelKey: 'sidebar.events',       route: '/admin/events',       roles: ['super_admin', 'tourist_organization'] },
  { icon: 'hiking',         labelKey: 'sidebar.activities',   route: '/admin/activities',   roles: ['super_admin', 'tourist_organization'] },
  { icon: 'storefront',    labelKey: 'sidebar.places',       route: '/admin/places',       roles: ['super_admin', 'tourist_organization', 'place_owner'] },
  { icon: 'star',           labelKey: 'sidebar.reviews',      route: '/admin/reviews',      roles: ['super_admin', 'tourist_organization', 'place_owner'] },
  { icon: 'people',         labelKey: 'sidebar.users',        route: '/admin/users',        roles: ['super_admin'] },
  { icon: 'bar_chart',      labelKey: 'sidebar.reports',      route: '/admin/reports',      roles: ['super_admin', 'tourist_organization'] },
  { icon: 'support_agent',  labelKey: 'sidebar.support',      route: '/admin/support',      roles: ['super_admin', 'tourist_organization', 'place_owner'] },
  { icon: 'settings',       labelKey: 'sidebar.settings',     route: '/admin/settings',     roles: ['super_admin', 'tourist_organization', 'place_owner'] },
];

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
})
export class AdminSidebar {
  isLanguagePopupOpen = false;
  languagePopupTop    = 0;
  languagePopupLeft   = 0;

  constructor(
    public auth:    DashboardAuthService,
    public ui:      AdminUiPreferencesService,
    public layout:  LayoutService,
    private authService: AuthService,
    private router: Router,
  ) {}

  get visibleItems(): NavItem[] {
    return NAV_ITEMS.filter(item => item.roles.includes(this.auth.role()));
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth >= 769) {
      this.layout.toggleDesktopSidebar();
    } else {
      this.layout.toggleMobileSidebar();
    }
  }

  closeSidebar(): void {
    this.layout.closeMobileSidebar();
  }

  toggleLanguagePopup(event: MouseEvent): void {
    if (this.isLanguagePopupOpen) {
      this.isLanguagePopupOpen = false;
      return;
    }
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    this.languagePopupTop  = rect.top;
    this.languagePopupLeft = rect.right + 8;
    this.isLanguagePopupOpen = true;
  }

  setLanguage(language: 'sr' | 'en'): void {
    this.ui.setLanguage(language);
    this.isLanguagePopupOpen = false;
  }

  languageLabel(): string {
    return this.ui.t(this.ui.language() === 'sr' ? 'language.sr' : 'language.en');
  }

  logout(): void {
    const refreshToken = this.authService.getRefreshToken();
    const doLogout = () => {
      this.authService.clearTokens();
      this.router.navigate(['/login']);
    };

    if (refreshToken) {
      this.authService.logout({ refreshToken }).subscribe({ next: doLogout, error: doLogout });
    } else {
      doLogout();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined' && window.innerWidth >= 769) {
      this.layout.closeMobileSidebar();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      this.isLanguagePopupOpen &&
      !target.closest('.lang-wrapper') &&
      !target.closest('.lang-popup')
    ) {
      this.isLanguagePopupOpen = false;
    }
  }
}
