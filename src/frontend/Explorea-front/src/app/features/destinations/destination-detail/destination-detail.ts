import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef, HostListener, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { DestinationService } from '../../../core/services/destination.service';
import { AuthService } from '../../../core/services/auth.service';
import { SavedService } from '../../../core/services/saved.service';
import {
  ActivityCard,
  DestinationDetail,
  EventCard,
  PlaceCard
} from '../../../core/models/destination.model';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { ReviewCard } from '../../../shared/components/review-card/review-card';

type DetailTab = 'places' | 'events' | 'activities' | 'reviews';
type TabItem = PlaceCard | EventCard | ActivityCard;

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [CommonModule, NgStyle, RouterModule, FormsModule, TranslateModule, Sidebar, BottomNav, ReviewCard],
  templateUrl: './destination-detail.html',
  styleUrls: ['./destination-detail.css']
})
export class DestinationDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destinationService = inject(DestinationService);
  private authService = inject(AuthService);
  private savedService = inject(SavedService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  private routeSub?: Subscription;
  private requestSub?: Subscription;

  destination: DestinationDetail | null = null;
  isLoading = true;
  error: string | null = null;
  selectedTab: DetailTab = 'places';

  lightboxOpen = false;
  selectedImageIndex = 0;

  isSaved = false;
  isSavedLoading = false;

  showAllOpen = false;
  private savedScrollY = 0;

  reviewFormOpen = false;
  reviewRating = 0;
  reviewHoverRating = 0;
  reviewComment = '';

  scrollProgress = 0;
  titleCaptured = false;
  private titleAbsTop = 0;
  private titleAbsLeft = 0;
  private scrollThreshold = 300;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');

      if (!slug) {
        this.error = this.translate.instant('DESTINATION_DETAIL.ERRORS.MISSING_SLUG');
        this.isLoading = false;
        this.destination = null;
        this.cdr.detectChanges();
        return;
      }

      this.loadDestination(slug);
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.requestSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  private captureTitle(): void {
    // Wait one tick for the DOM to render the h1
    setTimeout(() => {
      const el = this.heroTitleEl?.nativeElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      this.titleAbsTop  = rect.top + window.scrollY;
      this.titleAbsLeft = rect.left;
      // Scroll threshold = distance from title to target (top: 16px)
      this.scrollThreshold = Math.max(this.titleAbsTop - 16, 80);
      this.titleCaptured = true;
      this.cdr.detectChanges();
    }, 0);
  }

  private loadDestination(slug: string): void {
    this.requestSub?.unsubscribe();

    this.isLoading = true;
    this.error = null;
    this.destination = null;
    this.selectedTab = 'places';
    this.lightboxOpen = false;
    this.selectedImageIndex = 0;
    this.showAllOpen = false;
    this.reviewFormOpen = false;
    this.titleCaptured = false;
    this.scrollProgress = 0;
    this.cdr.detectChanges();

    this.requestSub = this.destinationService.getDestinationBySlug(slug).subscribe({
      next: (data) => {
        this.destination = data;
        this.isLoading = false;
        this.isSaved = false;
        window.scrollTo({ top: 0, behavior: 'auto' });
        this.cdr.detectChanges();
        this.captureTitle();
        if (this.authService.isLoggedIn()) {
          this.savedService.check('destination', data.id).subscribe({
            next: (res) => { this.isSaved = res.isSaved; this.cdr.detectChanges(); },
          });
        }
      },
      error: () => {
        this.error = this.translate.instant('DESTINATION_DETAIL.ERRORS.LOAD_FAILED');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: DetailTab): void {
    this.selectedTab = tab;
  }

  toggleSave(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (!this.destination || this.isSavedLoading) return;

    this.isSavedLoading = true;
    const id = this.destination.id;
    const action = this.isSaved
      ? this.savedService.unsave('destination', id)
      : this.savedService.save('destination', id);

    action.subscribe({
      next: () => {
        this.isSaved = !this.isSaved;
        this.isSavedLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSavedLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openAllImages(): void {
    if (this.galleryImages.length > 0) this.openLightbox(0);
  }

  openShowAll(): void {
    this.showAllOpen = true;
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  closeShowAll(): void {
    this.showAllOpen = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.savedScrollY, behavior: 'instant' as ScrollBehavior });
  }

  get previewTabItems(): TabItem[] {
    return this.activeTabItems.slice(0, 3);
  }

  get hasMoreTabItems(): boolean {
    return this.activeTabItems.length > 3;
  }

  get hasMoreReviews(): boolean {
    return (this.destination?.reviews.length ?? 0) > 3;
  }

  get showAllTitle(): string {
    switch (this.selectedTab) {
      case 'places':     return this.translate.instant('DESTINATION_DETAIL.ALL_PANEL.PLACES');
      case 'events':     return this.translate.instant('DESTINATION_DETAIL.ALL_PANEL.EVENTS');
      case 'activities': return this.translate.instant('DESTINATION_DETAIL.ALL_PANEL.ACTIVITIES');
      case 'reviews':    return this.translate.instant('DESTINATION_DETAIL.ALL_PANEL.REVIEWS');
      default: return '';
    }
  }

  openReviewForm(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.reviewRating = 0;
    this.reviewHoverRating = 0;
    this.reviewComment = '';
    this.reviewFormOpen = true;
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  closeReviewForm(): void {
    this.reviewFormOpen = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.savedScrollY, behavior: 'instant' as ScrollBehavior });
  }

  submitReview(): void {
    if (this.reviewRating === 0) return;
    // TODO: wire up backend
    this.closeReviewForm();
  }

  get ratingBreakdown(): { stars: number; count: number; pct: number }[] {
    const reviews = this.destination?.reviews ?? [];
    const total = reviews.length;
    return [5, 4, 3, 2, 1].map(stars => {
      const count = reviews.filter(r => r.rating === stars).length;
      return { stars, count, pct: total > 0 ? (count / total) * 100 : 0 };
    });
  }

  get showAllCount(): number {
    if (this.selectedTab === 'reviews') return this.destination?.reviews.length ?? 0;
    return this.activeTabItems.length;
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollProgress = Math.min(window.scrollY / this.scrollThreshold, 1);
    this.cdr.detectChanges();
  }

  private ease(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  get floatingTitleStyle(): Record<string, string> {
    if (!this.destination || !this.titleCaptured) return { opacity: '0' };
    const p = this.ease(this.scrollProgress);

    const isMobile = window.innerWidth <= 768;
    const endX = isMobile ? 16 : 88;
    const endY = 16;

    // Start: exact current viewport position of the original h1
    const startViewportTop  = this.titleAbsTop - window.scrollY;
    const startViewportLeft = this.titleAbsLeft;

    const tx = startViewportLeft + (endX - startViewportLeft) * p;
    const ty = startViewportTop  + (endY - startViewportTop)  * p;

    // Target ~17px regardless of base font size (52px desktop, 34px mobile)
    const baseSize = isMobile ? 34 : 52;
    const endScale = 17 / baseSize;
    const scale = 1 + (endScale - 1) * p;

    return {
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      opacity: '1',
    };
  }

  // h1 je odmah sakriven čim floating title preuzme
  get heroTitleOpacity(): number {
    return this.titleCaptured ? 0 : 1;
  }

  get heroBadgesOpacity(): number {
    return Math.max(1 - this.scrollProgress * 2, 0);
  }

  get stickyBarVisible(): boolean {
    return this.scrollProgress > 0.88 && !this.isLoading && !!this.destination;
  }

  get locationText(): string {
    if (!this.destination) return '';
    const city = this.destination.city?.name;
    const country = this.destination.country?.name;
    return [city, country].filter(Boolean).join(', ');
  }

  get heroImage(): string {
    if (!this.destination) return 'https://via.placeholder.com/1400x700';
    return (
      this.destination.heroImageUrl ||
      this.destination.previewImageUrl ||
      'https://via.placeholder.com/1400x700'
    );
  }

  get galleryImages(): string[] {
    if (!this.destination) return [];

    const images = this.destination.images?.map(img => img.imageUrl) ?? [];
    if (images.length > 0) return images;

    return [
      this.destination.heroImageUrl,
      this.destination.previewImageUrl
    ].filter(Boolean) as string[];
  }

  get activeTabItems(): TabItem[] {
    if (!this.destination) return [];

    switch (this.selectedTab) {
      case 'places':
        return this.destination.places;
      case 'events':
        return this.destination.events;
      case 'activities':
        return this.destination.activities;
      default:
        return [];
    }
  }

  trackById(_: number, item: TabItem): string {
    return item.id;
  }

  getItemImage(item: TabItem): string {
    return item.previewImageUrl || 'https://via.placeholder.com/300x200';
  }

  getItemTypeLabel(): string {
    switch (this.selectedTab) {
      case 'places':
        return this.translate.instant('DESTINATION_DETAIL.ITEM_TYPES.PLACE');
      case 'events':
        return this.translate.instant('DESTINATION_DETAIL.ITEM_TYPES.EVENT');
      case 'activities':
        return this.translate.instant('DESTINATION_DETAIL.ITEM_TYPES.ACTIVITY');
      default:
        return '';
    }
  }

  getItemLocationText(item: TabItem): string {
    const locationNotAvailable = this.translate.instant('DESTINATION_DETAIL.LOCATION_NOT_AVAILABLE');

    if (this.isPlace(item)) {
      return item.address || item.country?.name || locationNotAvailable;
    }

    if (this.isEvent(item)) {
      const city = item.city?.name;
      const country = item.country?.name;
      const address = item.address;
      return [address, city, country].filter(Boolean).join(', ') || locationNotAvailable;
    }

    return item.country?.name || locationNotAvailable;
  }

  getItemRating(item: TabItem): number | null {
    if (this.isPlace(item) || this.isActivity(item)) {
      return item.avgRating;
    }

    return null;
  }

  getItemMetaLabel(item: TabItem): string {
    if (this.isEvent(item)) {
      return this.translate.instant('DESTINATION_DETAIL.META.EVENT');
    }

    return this.translate.instant('DESTINATION_DETAIL.META.RATING');
  }

  getItemRoute(item: TabItem): string[] {
    if (this.isPlace(item)) {
      return ['/places', item.slug];
    }

    if (this.isEvent(item)) {
      return ['/events', item.slug];
    }

    return ['/activities', item.slug];
  }

  getStarsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  openLightbox(index: number): void {
    this.selectedImageIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  prevImage(): void {
    const total = this.galleryImages.length;
    if (!total) return;
    this.selectedImageIndex = (this.selectedImageIndex - 1 + total) % total;
  }

  nextImage(): void {
    const total = this.galleryImages.length;
    if (!total) return;
    this.selectedImageIndex = (this.selectedImageIndex + 1) % total;
  }

  get currentLightboxImage(): string {
    return this.galleryImages[this.selectedImageIndex] || '';
  }

  get mapCoordinatesText(): string {
    const lat = this.destination?.location?.lat;
    const lng = this.destination?.location?.lng;

    if (lat == null || lng == null) {
      return this.translate.instant('DESTINATION_DETAIL.LOCATION_NOT_AVAILABLE');
    }

    return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }

  get googleMapsUrl(): string {
    const lat = this.destination?.location?.lat;
    const lng = this.destination?.location?.lng;

    if (lat == null || lng == null) {
      return 'https://maps.google.com';
    }

    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  private isPlace(item: TabItem): item is PlaceCard {
    return this.selectedTab === 'places';
  }

  private isEvent(item: TabItem): item is EventCard {
    return this.selectedTab === 'events';
  }

  private isActivity(item: TabItem): item is ActivityCard {
    return this.selectedTab === 'activities';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) this.closeLightbox();
    else if (this.showAllOpen) this.closeShowAll();
    else if (this.reviewFormOpen) this.closeReviewForm();
  }

  @HostListener('document:keydown.arrowLeft')
  onArrowLeft(): void {
    if (this.lightboxOpen) this.prevImage();
  }

  @HostListener('document:keydown.arrowRight')
  onArrowRight(): void {
    if (this.lightboxOpen) this.nextImage();
  }
}