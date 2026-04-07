import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UpdatePreferencesDto, UpdateUserDto, UserProfile } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService } from '../../../core/services/user.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, BottomNav, TranslateModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  user: UserProfile | null = null;

  username = '';
  notificationsEnabled = false;
  marketingEmails = false;
  privateProfile = false;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
    public languageService: LanguageService,
  ) {}

  get language() {
    return this.languageService.current;
  }

  set language(lang: string) {
    this.languageService.set(lang as 'sr' | 'en');
  }

  ngOnInit() {
    // Mock podaci dok backend nije implementiran
    this.user = {
      id: '1',
      firstName: 'Ana',
      lastName: 'Tanasković',
      email: 'ana.t@example.rs',
      travelerRank: 'Iskusni Putnik',
      totalVisits: 24,
      memberSince: '2023-03-01',
      preferences: {
        theme: 'system',
        language: 'sr',
        notificationsEnabled: true,
      },
    };

    this.username = this.user.firstName + '_' + this.user.lastName.toLowerCase();
    this.notificationsEnabled = this.user.preferences?.notificationsEnabled ?? false;
  }

  logout() {
    const refreshToken = this.authService.getRefreshToken();
    if (refreshToken) {
      this.authService.logout({ refreshToken }).subscribe({
        complete: () => {
          this.authService.clearTokens();
          this.router.navigate(['/login']);
        },
        error: () => {
          this.authService.clearTokens();
          this.router.navigate(['/login']);
        },
      });
    } else {
      this.authService.clearTokens();
      this.router.navigate(['/login']);
    }
  }

  sacuvaj() {
    const userDto: UpdateUserDto = {
      firstName: this.user?.firstName ?? '',
      lastName: this.user?.lastName ?? '',
    };

    const prefsDto: UpdatePreferencesDto = {
      theme: 'system',
      language: this.languageService.current,
      notificationsEnabled: this.notificationsEnabled,
    };

    this.userService.updateMe(userDto).subscribe();
    this.userService.updatePreferences(prefsDto).subscribe();
  }
}
