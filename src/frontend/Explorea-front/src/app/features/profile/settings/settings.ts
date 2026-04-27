import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ForYouItemDto, ProfileReviewDto, ProfileStatsDto, UpdateUserDto, UserProfile } from '../../../core/models/user.model';
import { ReviewDto } from '../../../core/models/home.model';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarService } from '../../../core/services/avatar.service';
import { InterestsService } from '../../../core/services/interests.service';
import { LanguageService } from '../../../core/services/language.service';
import { LocationService } from '../../../core/services/location.service';
import { ProfileService } from '../../../core/services/profile.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService } from '../../../core/services/user.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { ReviewCard } from '../../../shared/components/review-card/review-card';

const SCROLL_KEY = 'profile_scroll_y';
const SECTION_KEY = 'profile_open_section';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Sidebar, BottomNav, TranslateModule, ImageCropperComponent, ReviewCard],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  user: UserProfile | null = null;
  stats: ProfileStatsDto | null = null;
  forYouItems: ForYouItemDto[] = [];
  isHeroLoading = true;
  isForYouLoading = true;

  firstName = '';
  lastName = '';
  firstNameError = '';
  lastNameError = '';
  fileError = '';
  private originalFirstName = '';
  private originalLastName = '';
  passwordChangeRequested = false;
  passwordChangeSending = false;
  avatarUrl: string | null = null;
  newsletter = false;

  private readonly NAME_BLACKLIST = [
    'kurac', 'kurац', 'picka', 'pička', 'pizda', 'guzica', 'sisa', 'jebem', 'jebo',
    'nigger', 'nigga', 'niger', 'fuck', 'shit', 'dick', 'cunt', 'bitch', 'asshole',
    'retard', 'faggot', 'pussy', 'cock', 'whore', 'slut',
  ];

  showCropper = false;
  isUploading = false;
  imageChangedEvent: Event | null = null;
  private lastCropEvent: ImageCroppedEvent | null = null;

  openSection: 'profile' | 'app' | 'reviews' | null = null;
  reviewDtos: ReviewDto[] = [];
  reviewsLoaded = false;
  reviewsLoading = false;
  currentUserId = '';

  get isDirty(): boolean {
    return this.firstName !== this.originalFirstName || this.lastName !== this.originalLastName;
  }

  get selectedInterestsLabel(): string {
    const ids = this.interestsService.getSelectedIds();
    if (ids.length === 0) return 'Nisu izabrani interesi';
    const label = this.interestsService.getSelectedLabels();
    return label || 'Nisu izabrani interesi';
  }

  constructor(
    private profileService: ProfileService,
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
    public languageService: LanguageService,
    public locationService: LocationService,
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
    this.currentUserId = this.authService.getCurrentUserId();
    this.avatarUrl = this.avatarService.getUrl();
    this.interestsService.getInterestTags().subscribe();  // popuni cache za selectedInterestsLabel

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
          this.firstName = profile.firstName;
          this.lastName = profile.lastName;
          this.originalFirstName = profile.firstName;
          this.originalLastName = profile.lastName;
          this.newsletter = profile.newsletter;
          // Sinhronizuj avatar sa serverom (server je izvor istine)
          if (profile.profileImageUrl) {
            this.avatarUrl = profile.profileImageUrl;
            this.avatarService.setUrl(profile.profileImageUrl);
          } else {
            this.avatarUrl = null;
            this.avatarService.clear();
          }
          this.cdr.detectChanges();
          this.startPolling();
        },
        error: () => { this.cdr.detectChanges(); },
      });

    // For you — nezavisno
    this.profileService.getForYou()
      .pipe(finalize(() => { this.isForYouLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (items) => {
          this.forYouItems = items;
          this.cdr.detectChanges();
        },
        error: () => { this.cdr.detectChanges(); },
      });
  }

  ngAfterViewInit() {
    const savedY = sessionStorage.getItem(SCROLL_KEY);
    if (savedY !== null) {
      sessionStorage.removeItem(SCROLL_KEY);
      setTimeout(() => window.scrollTo({ top: parseInt(savedY, 10), behavior: 'instant' }), 0);
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.pollInterval = setInterval(() => {
      if (this.isUploading) return;
      this.profileService.getProfile().subscribe({
        next: (p) => {
          const serverUrl = p.profileImageUrl ?? null;
          if (serverUrl !== this.avatarUrl) {
            this.avatarUrl = serverUrl;
            this.avatarService.setUrl(serverUrl);
            this.cdr.detectChanges();
          }
        },
      });
    }, 30000);
  }

  private stopPolling() {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getEntityRoute(item: ForYouItemDto): string[] {
    switch (item.entityType) {
      case 'destination': return ['/destinations', item.slug];
      case 'place':       return ['/places', item.slug];
      case 'event':       return ['/events', item.slug];
      case 'activity':    return ['/activities', item.slug];
      default:            return ['/'];
    }
  }

  toggleSection(section: 'profile' | 'app' | 'reviews') {
    this.openSection = this.openSection === section ? null : section;
    if (section === 'profile') {
      this.passwordChangeRequested = false;
    }
    if (section === 'reviews' && this.openSection === 'reviews' && !this.reviewsLoaded) {
      this.loadMyReviews();
    }
  }

  private loadMyReviews(): void {
    this.reviewsLoading = true;
    this.cdr.detectChanges();
    this.profileService.getMyReviews().subscribe({
      next: (reviews) => {
        this.reviewDtos = this.buildReviewDtos(reviews);
        this.reviewsLoaded = true;
        this.reviewsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.reviewDtos = [];
        this.reviewsLoaded = true;
        this.reviewsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildReviewDtos(reviews: ProfileReviewDto[]): ReviewDto[] {
    if (!this.user) return [];
    return reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? '',
      createdAt: r.createdAt,
      entityType: r.entityType,
      entityName: r.entityName,
      entitySlug: r.entitySlug,
      user: {
        id: this.user!.id,
        firstName: this.user!.firstName,
        lastName: this.user!.lastName,
        travelerRank: this.user!.travelerRank,
        profileImageUrl: this.user!.profileImageUrl ?? null,
      },
    }));
  }

  trackReviewById(_: number, r: ReviewDto): string {
    return r.id;
  }

  onReviewDeleted(id: string): void {
    this.reviewDtos = this.reviewDtos.filter(r => r.id !== id);
    this.cdr.detectChanges();
  }

  onReviewUpdated(review: ReviewDto): void {
    const idx = this.reviewDtos.findIndex(r => r.id === review.id);
    if (idx !== -1) {
      this.reviewDtos[idx] = { ...this.reviewDtos[idx], rating: review.rating, comment: review.comment ?? '' };
      this.cdr.detectChanges();
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

    this.fileError = '';

    if (file.size > 5 * 1024 * 1024) {
      this.fileError = 'Slika ne sme biti veća od 5MB.';
      this.fileInput.nativeElement.value = '';
      this.cdr.detectChanges();
      return;
    }

    this.imageChangedEvent = event;
    this.lastCropEvent = null;
    this.showCropper = true;
    this.cdr.detectChanges();
  }

  onImageCropped(event: ImageCroppedEvent) {
    this.lastCropEvent = event;
  }

  onCropConfirm() {
    if (!this.lastCropEvent) return;

    if (this.lastCropEvent.blob) {
      this.uploadCropBlob(this.lastCropEvent.blob);
    } else if (this.lastCropEvent.base64) {
      const base64 = this.lastCropEvent.base64.split(',')[1];
      const bytes = atob(base64);
      const ab = new ArrayBuffer(bytes.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i);
      this.uploadCropBlob(new Blob([ab], { type: 'image/jpeg' }));
    }
  }

  private uploadCropBlob(blob: Blob) {
    // Zatvori modal odmah, pokaži skeleton u avataru
    this.showCropper = false;
    this.imageChangedEvent = null;
    this.lastCropEvent = null;
    this.isUploading = true;
    this.fileInput.nativeElement.value = '';
    this.cdr.detectChanges();

    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    this.avatarService.upload(file).subscribe({
      next: (url) => {
        this.avatarUrl = url;
        this.isUploading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isUploading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onCropCancel() {
    this.showCropper = false;
    this.imageChangedEvent = null;
    this.lastCropEvent = null;
    this.fileInput.nativeElement.value = '';
  }

  removeAvatar() {
    const previousUrl = this.avatarUrl;
    this.avatarUrl = null;
    this.avatarService.clear();
    this.fileInput.nativeElement.value = '';
    this.profileService.removeAvatar().subscribe({
      error: () => {
        // Vrati ako backend ne uspe
        this.avatarUrl = previousUrl;
        if (previousUrl) this.avatarService.setUrl(previousUrl);
        this.cdr.detectChanges();
      },
    });
  }

  cancelProfileEdit() {
    this.firstName = this.originalFirstName;
    this.lastName = this.originalLastName;
    this.passwordChangeRequested = false;
    this.openSection = null;
  }

  requestPasswordChange() {
    if (!this.user?.email || this.passwordChangeSending) return;
    this.passwordChangeSending = true;
    this.cdr.detectChanges();
    this.authService.forgotPassword({ email: this.user.email }).subscribe({
      next: () => {
        this.passwordChangeSending = false;
        this.passwordChangeRequested = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.passwordChangeSending = false;
        this.passwordChangeRequested = true;
        this.cdr.detectChanges();
      },
    });
  }

  toggleLocation(): void {
    if (this.locationService.isEnabled()) {
      this.locationService.disable();
    } else {
      this.locationService.enable();
    }
    this.cdr.detectChanges();
  }

  toggleNewsletter() {
    const newValue = !this.newsletter;
    this.newsletter = newValue;
    this.cdr.detectChanges();
    this.profileService.updateNewsletter(newValue).subscribe({
      error: () => {
        this.newsletter = !newValue;
        this.cdr.detectChanges();
      },
    });
  }

  validateName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return 'Polje ne sme biti prazno.';
    if (!/^[a-zA-ZčćžšđČĆŽŠĐ]+$/.test(trimmed)) return 'Dozvoljena su samo slova.';
    if (this.NAME_BLACKLIST.some(w => trimmed.toLowerCase().includes(w)))
      return 'Ovo ime nije dozvoljeno.';
    return '';
  }

  sacuvajProfil() {
    if (!this.user) return;

    this.firstNameError = this.validateName(this.firstName);
    this.lastNameError  = this.validateName(this.lastName);
    this.cdr.detectChanges();
    if (this.firstNameError || this.lastNameError) return;

    const dto: UpdateUserDto = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      profileImageUrl: this.avatarUrl ?? undefined,
    };

    this.profileService.updateProfile(dto).subscribe({
      next: (updated) => {
        this.user = updated;
        this.originalFirstName = updated.firstName;
        this.originalLastName = updated.lastName;
        this.firstName = updated.firstName;
        this.lastName = updated.lastName;
        this.firstNameError = '';
        this.lastNameError  = '';
        this.cdr.detectChanges();
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
