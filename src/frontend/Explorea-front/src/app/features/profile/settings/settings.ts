import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ForYouItemDto, ProfileStatsDto, UpdateUserDto, UserProfile } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarService } from '../../../core/services/avatar.service';
import { InterestsService } from '../../../core/services/interests.service';
import { LanguageService } from '../../../core/services/language.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService } from '../../../core/services/user.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

const SCROLL_KEY = 'profile_scroll_y';
const SECTION_KEY = 'profile_open_section';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Sidebar, BottomNav, TranslateModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit, AfterViewInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  user: UserProfile | null = null;
  stats: ProfileStatsDto | null = null;
  forYouItems: ForYouItemDto[] = [];
  isHeroLoading = true;
  isForYouLoading = true;

  username = '';
  private originalUsername = '';
  passwordChangeRequested = false;
  avatarUrl: string | null = null;

  openSection: 'profile' | 'app' | null = null;

  get isDirty(): boolean {
    return this.username !== this.originalUsername;
  }

  private readonly ALL_INTERESTS = [
    { id: 1, label: 'Avanture' },
    { id: 2, label: 'Clubing' },
    { id: 3, label: 'Kultura' },
    { id: 4, label: 'Umetnost' },
    { id: 5, label: 'Hrana' },
    { id: 6, label: 'Sport' },
  ];

  get selectedInterestsLabel(): string {
    const ids = this.interestsService.getSelectedIds();
    if (ids.length === 0) return 'Nisu izabrani interesi';
    return this.ALL_INTERESTS.filter((i) => ids.includes(i.id))
      .map((i) => i.label)
      .join(', ');
  }

  constructor(
    private profileService: ProfileService,
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
    public languageService: LanguageService,
    private interestsService: InterestsService,
    private avatarService: AvatarService,
    private cdr: ChangeDetectorRef,
  ) {}

  get language() {
    return this.languageService.current;
  }

  set language(lang: string) {
    this.languageService.set(lang as 'sr' | 'en');
  }

  ngOnInit() {
    this.avatarUrl = this.avatarService.getDataUrl();

    const savedSection = sessionStorage.getItem(SECTION_KEY);
    if (savedSection === 'profile' || savedSection === 'app') {
      this.openSection = savedSection;
      sessionStorage.removeItem(SECTION_KEY);
    }

    // Profil + stats zajedno (idu u hero)
    forkJoin({
      profile: this.profileService.getProfile(),
      stats: this.profileService.getStats(),
    }).pipe(finalize(() => { this.isHeroLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: ({ profile, stats }) => {
          this.user = profile;
          this.stats = stats;
          this.username = profile.firstName + '_' + profile.lastName.toLowerCase();
          this.originalUsername = this.username;
          this.cdr.detectChanges();
        },
      });

    // For you — nezavisno
    this.profileService.getForYou()
      .pipe(finalize(() => { this.isForYouLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (items) => {
          this.forYouItems = items;
          this.cdr.detectChanges();
        },
      });
  }

  ngAfterViewInit() {
    const savedY = sessionStorage.getItem(SCROLL_KEY);
    if (savedY !== null) {
      sessionStorage.removeItem(SCROLL_KEY);
      setTimeout(() => window.scrollTo({ top: parseInt(savedY, 10), behavior: 'instant' }), 0);
    }
  }

  getEntityRoute(item: ForYouItemDto): string[] {
    if (item.entityType === 'activity') return ['/activities', item.slug];
    return ['/'];
  }

  toggleSection(section: 'profile' | 'app') {
    this.openSection = this.openSection === section ? null : section;
    if (section === 'profile') {
      this.passwordChangeRequested = false;
    }
  }

  izmeniInterese() {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    if (this.openSection) {
      sessionStorage.setItem(SECTION_KEY, this.openSection);
    }
    this.router.navigate(['/interests'], { queryParams: { from: 'profile' } });
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.avatarUrl = dataUrl;
      this.avatarService.saveDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  removeAvatar() {
    this.avatarUrl = null;
    this.avatarService.clear();
    this.fileInput.nativeElement.value = '';
  }

  cancelProfileEdit() {
    this.username = this.originalUsername;
    this.passwordChangeRequested = false;
    this.openSection = null;
  }

  requestPasswordChange() {
    this.passwordChangeRequested = true;
  }

  sacuvajProfil() {
    if (!this.user) return;

    const dto: UpdateUserDto = {
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      profileImageUrl: this.avatarUrl ?? undefined,
    };

    this.profileService.updateProfile(dto).subscribe({
      next: (updated) => {
        this.user = updated;
        this.originalUsername = this.username;
        this.openSection = null;
      },
    });
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
}
