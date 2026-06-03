import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ChangeDetectorRef, HostListener, ViewChild, ElementRef, inject
} from '@angular/core';
import { CommonModule, Location, NgStyle } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';

import { ActivityCard, ActivityDetail } from '../../../core/models/activity.model';
import { ActivityService } from '../../../core/services/activity.service';
import { AuthService } from '../../../core/services/auth.service';
import { SavedService } from '../../../core/services/saved.service';
import { PopularityService } from '../../../core/services/popularity.service';
import { ReviewService } from '../../../core/services/review.service';
import { ReviewDto } from '../../../core/models/home.model';
import { ReviewCard } from '../../../shared/components/review-card/review-card';
import { ReviewModal } from '../../../shared/components/review-modal/review-modal';
import { DetailFooter } from '../../../shared/components/detail-footer/detail-footer';
import { RatingStats } from '../../../shared/components/rating-stats/rating-stats';
import { ReviewsPanel } from '../../../shared/components/reviews-panel/reviews-panel';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { ShareButton } from '../../../shared/components/share-button/share-button';
import { AddToPlannerModal } from '../../../shared/components/add-to-planner-modal/add-to-planner-modal';

import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';
const DESKTOP_SIMILAR_LIMIT = 6;
const MOBILE_SIMILAR_LIMIT = 4;

const DARK = {
  land: '#1e2e24', water: '#102840', park: '#1e3228',
  road_major: '#486858', road_minor: '#364e40', road_path: '#2c4436',
  building: '#253828', building_outline: '#30503c', extrusion: '#5a9e78',
  boundary: '#335244', text: '#c8d8cc', text_halo: '#182818',
  sand: '#262614', pedestrian: '#283e30', surface: '#243a2c',
  bridge: '#2e4c3a', icon: '#8aab96',
};

const LIGHT = {
  land: '#eef1ec', water: '#6bb0d4', park: '#96c89c',
  road_major: '#ffffff', road_minor: '#f5f8f4', road_path: '#deeadc',
  building: '#ccd8c8', building_outline: '#b0c4ac', extrusion: '#a2dcad',
  boundary: '#6b826b', text: '#1a3828', text_halo: '#eef1ec',
  sand: '#e0d8b0', pedestrian: '#dce8d8', surface: '#e4eee0',
  bridge: '#d8e4d4', icon: '#28694c',
};

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, NgStyle, RouterModule, TranslateModule, Sidebar, BottomNav, ReviewCard, ReviewModal, DetailFooter, RatingStats, ReviewsPanel, ShareButton, AddToPlannerModal],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);
  private savedService = inject(SavedService);
  private reviewService = inject(ReviewService);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private popularityService = inject(PopularityService);

  activity: ActivityDetail | null = null;
  loading = true;
  descriptionExpanded = false;

  isSaved = false;
  isSavedLoading = false;
  showPlannerModal = false;

  hasReviewed = false;
  currentUserId = '';

  // Gallery lightbox
  lightboxOpen = false;
  selectedImageIndex = 0;
  private lightboxScrollY = 0;
  private lightboxLockedBody = false;

  // Show-all panel (similar activities)
  showAllOpen = false;
  showAllMode: 'similar' | 'reviews' = 'similar';
  reviewsPanelOpen = false;
  private savedScrollY = 0;

  // Review form
  reviewFormOpen = false;

  scrollProgress = 0;
  titleCaptured = false;
  private titleAbsTop = 0;
  private titleAbsLeft = 0;
  private scrollThreshold = 300;

  private map?: MapLibreMap;
  private marker?: Marker;
  private mapInitialized = false;
  private lightStyle: any = null;
  private darkStyle: any = null;
  private themeObserver?: MutationObserver;

  private routeSub?: Subscription;
  private slug = '';

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.routeSub = this.route.paramMap.subscribe(params => {
      this.slug = params.get('slug') ?? '';
      this.loading = true;
      this.activity = null;
      this.descriptionExpanded = false;
      this.titleCaptured = false;
      this.scrollProgress = 0;
      this.mapInitialized = false;
      this.hasReviewed = false;
      this.marker?.remove();
      this.map?.remove();
      this.map = undefined;
      this.cdr.detectChanges();

      document.documentElement.style.removeProperty('--chat-bubble-bottom-mobile');

      this.activityService.getBySlug(this.slug).subscribe({
        next: (data) => {
          this.activity = data;
          if (data.organizerWebsite) {
            document.documentElement.style.setProperty('--chat-bubble-bottom-mobile', '150px');
          }
          this.loading = false;
          window.scrollTo({ top: 0, behavior: 'auto' });
          this.popularityService.track('activity', data.id);
          this.cdr.detectChanges();
          this.captureTitle();
          if (this.authService.isLoggedIn()) {
            this.savedService.check('activity', data.id).subscribe({
              next: (res) => { this.isSaved = res.isSaved; this.cdr.detectChanges(); },
            });
            this.reviewService.check('activity', data.id).subscribe({
              next: (res) => { this.hasReviewed = res.hasReviewed; this.cdr.detectChanges(); },
            });
          }
          setTimeout(() => this.initMap(), 100);
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.marker?.remove();
    this.map?.remove();
    this.themeObserver?.disconnect();
    this.unlockLightboxScroll();
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.documentElement.style.removeProperty('--chat-bubble-bottom-mobile');
  }

  private captureTitle(): void {
    setTimeout(() => {
      const el = this.heroTitleEl?.nativeElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      this.titleAbsTop = rect.top + window.scrollY;
      this.titleAbsLeft = rect.left;
      this.scrollThreshold = Math.max(this.titleAbsTop - 16, 80);
      this.titleCaptured = true;
      this.cdr.detectChanges();
    }, 0);
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private luminance(hex: string): number {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return 0;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r * 0.299 + g * 0.587 + b * 0.114;
  }

  private buildThemedStyle(base: any, p: typeof DARK & typeof LIGHT): any {
    const themed = JSON.parse(JSON.stringify(base));
    themed.layers = themed.layers.map((layer: any) => {
      const id: string = layer.id ?? '';
      const type: string = layer.type ?? '';
      if (!layer.paint) return layer;
      delete layer.paint['fill-pattern'];
      switch (type) {
        case 'background':
          layer.paint['background-color'] = p.land; break;
        case 'fill': {
          if (/building/.test(id)) { layer.paint['fill-opacity'] = 0; break; }
          let fillColor: string;
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id)) {
            fillColor = p.water; layer.paint['fill-outline-color'] = p.water;
          } else if (/forest|wood|orchard|scrub|grass|meadow|park|nature|garden|vegetation|landcover/.test(id)) {
            fillColor = p.park; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.park;
          } else if (/landuse/.test(id)) { fillColor = p.park;
          } else if (/sand|beach|desert|bare/.test(id)) { fillColor = p.sand;
          } else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id)) {
            fillColor = p.pedestrian; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.pedestrian;
          } else if (/bridge/.test(id)) { fillColor = p.bridge;
          } else {
            const orig = typeof layer.paint['fill-color'] === 'string' ? layer.paint['fill-color'] : '';
            fillColor = this.luminance(orig) > 128 ? p.surface : p.land;
          }
          layer.paint['fill-color'] = fillColor; break;
        }
        case 'line': {
          let lineColor: string;
          if (/water|river|stream|canal|lake/.test(id)) { lineColor = p.water;
          } else if (/motorway|trunk/.test(id)) { lineColor = p.road_major;
          } else if (/primary|secondary|tertiary|road|street|residential|service/.test(id)) { lineColor = p.road_minor;
          } else if (/path|track|foot|cycle|pedestrian/.test(id)) { lineColor = p.road_path;
          } else if (/boundary|admin|border/.test(id)) { lineColor = p.boundary;
          } else if (/bridge/.test(id)) { lineColor = p.bridge;
          } else if (/casing|outline/.test(id)) { lineColor = p.land;
          } else {
            const orig = typeof layer.paint['line-color'] === 'string' ? layer.paint['line-color'] : '';
            lineColor = this.luminance(orig) > 128 ? p.road_minor : p.land;
          }
          layer.paint['line-color'] = lineColor; break;
        }
        case 'fill-extrusion':
          layer.paint['fill-extrusion-color'] = p.extrusion;
          layer.paint['fill-extrusion-opacity'] = 1; break;
        case 'symbol':
          layer.paint['text-color'] = p.text;
          if (layer.paint['text-halo-color']) layer.paint['text-halo-color'] = p.text_halo;
          if (layer.paint['icon-color']) layer.paint['icon-color'] = p.icon; break;
      }
      return layer;
    });
    return themed;
  }

  private createPinElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'map-pin-btn';
    el.innerHTML = `<div class="pin-bubble"><span class="material-icons">directions_run</span></div>`;
    return el;
  }

  private watchTheme(): void {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map) return;
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        if (this.activity?.location) {
          const { lat, lng } = this.activity.location;
          this.marker?.remove();
          this.marker = new maplibregl.Marker({ element: this.createPinElement(), anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(this.map!);
        }
      });
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private async initMap(): Promise<void> {
    if (this.mapInitialized || !this.mapContainer || !this.activity?.location) return;
    const { lat, lng } = this.activity.location;
    this.mapInitialized = true;

    const res = await fetch(MAP_STYLE_URL);
    const base = patchStyleSources(await res.json());
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle = this.buildThemedStyle(base, DARK);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [lng, lat],
      zoom: 16,
      pitch: 45,
      bearing: -17.6,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    this.map.on('load', () => {
      this.marker = new maplibregl.Marker({ element: this.createPinElement(), anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(this.map!);

      // Remove auto-expanded class so attribution starts collapsed
      const attrib = this.mapContainer?.nativeElement.querySelector('.maplibregl-ctrl-attrib');
      attrib?.classList.remove('maplibregl-compact-show');

      this.cdr.detectChanges();
    });

    this.watchTheme();
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
    if (!this.activity || !this.titleCaptured) return { opacity: '0' };
    const p = this.ease(this.scrollProgress);
    const isMobile = window.innerWidth <= 768;
    const endX = isMobile ? 68 : 140;
    const startViewportTop = this.titleAbsTop - window.scrollY;
    const startViewportLeft = this.titleAbsLeft;
    const tx = startViewportLeft + (endX - startViewportLeft) * p;
    const ty = startViewportTop + (20 - startViewportTop) * p;
    const baseSize = isMobile ? Math.max(20, Math.min(28, window.innerWidth * 0.055)) : 52;
    const scale = 1 + ((isMobile ? 16 : 17) / baseSize - 1) * p;
    return {
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      opacity: '1',
    };
  }

  get heroTitleOpacity(): number {
    return this.titleCaptured ? 0 : 1;
  }

  get heroBadgesOpacity(): number {
    return Math.max(1 - this.scrollProgress * 2, 0);
  }

  get stickyBarVisible(): boolean {
    return this.scrollProgress > 0.88 && !this.loading && !!this.activity;
  }

  get heroImage(): string {
    const first = this.activity?.images?.[0]?.imageUrl;
    return first ?? this.activity?.previewImageUrl ?? '';
  }

  get shortDescription(): string {
    const desc = this.activity?.description ?? '';
    if (desc.length <= 300) return desc;
    return desc.slice(0, 300) + '…';
  }

  get googleMapsDirectionsUrl(): string {
    const lat = this.activity?.location?.lat;
    const lng = this.activity?.location?.lng;
    if (lat == null || lng == null) return 'https://maps.google.com';
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  // Similar activities

  get similarLimit(): number {
    return window.innerWidth <= 768 ? MOBILE_SIMILAR_LIMIT : DESKTOP_SIMILAR_LIMIT;
  }

  get visibleSimilar(): ActivityCard[] {
    return this.activity?.similarActivities.slice(0, this.similarLimit) ?? [];
  }

  get hasMoreSimilar(): boolean {
    return (this.activity?.similarActivities.length ?? 0) > this.similarLimit;
  }

  // Show-all panel

  openShowAll(mode: 'similar' | 'reviews'): void {
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    if (mode === 'reviews') {
      this.reviewsPanelOpen = true;
    } else {
      this.showAllMode = mode;
      this.showAllOpen = true;
    }
  }

  closeShowAll(): void {
    this.showAllOpen = false;
    this.reviewsPanelOpen = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.savedScrollY, behavior: 'instant' as ScrollBehavior });
  }

  // Review form

  openReviewForm(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.reviewFormOpen = true;
  }

  onReviewSubmitted(review: ReviewDto): void {
    if (!this.activity) return;
    const newReviews = [{ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt, user: { id: review.user.id, firstName: review.user.firstName, lastName: review.user.lastName, travelerRank: review.user.travelerRank, profileImageUrl: review.user.profileImageUrl ?? null } }, ...this.activity.reviews];
    this.activity.reviews = newReviews;
    this.activity.avgRating = this.calcAvg(newReviews);
    this.hasReviewed = true;
    this.cdr.detectChanges();
  }

  onReviewDeleted(id: string): void {
    if (!this.activity) return;
    this.activity.reviews = this.activity.reviews.filter(r => r.id !== id);
    this.activity.avgRating = this.calcAvg(this.activity.reviews);
    this.hasReviewed = false;
    this.cdr.detectChanges();
  }

  onReviewUpdated(review: ReviewDto): void {
    if (!this.activity) return;
    const idx = this.activity.reviews.findIndex(r => r.id === review.id);
    if (idx !== -1) {
      const updated = [...this.activity.reviews];
      updated[idx] = { ...updated[idx], rating: review.rating, comment: review.comment };
      this.activity.reviews = updated;
      this.activity.avgRating = this.calcAvg(updated);
      this.cdr.detectChanges();
    }
  }

  private calcAvg(reviews: { rating: number }[]): number {
    if (!reviews.length) return 0;
    return Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10;
  }

  getStarsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  toggleSave(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (!this.activity || this.isSavedLoading) return;
    this.isSavedLoading = true;
    const action = this.isSaved
      ? this.savedService.unsave('activity', this.activity.id)
      : this.savedService.save('activity', this.activity.id);
    action.subscribe({
      next: () => { this.isSaved = !this.isSaved; this.isSavedLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isSavedLoading = false; this.cdr.detectChanges(); },
    });
  }

  formatDuration(minutes: number | null): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}-${h + 1}h` : `${h}h`;
  }

  getElevation(): string {
    return (this.activity?.extraData?.['elevation'] as string) ?? '';
  }

  getTrailType(): string {
    return (this.activity?.extraData?.['trailType'] as string) ?? '';
  }

  get galleryImages(): string[] {
    return (this.activity?.images ?? [])
      .slice(0, 10)
      .map(i => i.imageUrl);
  }

  get currentLightboxImage(): string {
    return this.galleryImages[this.selectedImageIndex] ?? '';
  }

  openAllImages(): void {
    if (this.galleryImages.length > 0) this.openLightbox(0);
  }

  openLightbox(index: number): void {
    this.selectedImageIndex = index;
    this.lightboxOpen = true;
    this.lockLightboxScroll();
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    this.unlockLightboxScroll();
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

  private lockLightboxScroll(): void {
    if (document.body.style.position === 'fixed') return;
    this.lightboxScrollY = window.scrollY;
    this.lightboxLockedBody = true;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.lightboxScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockLightboxScroll(): void {
    if (!this.lightboxLockedBody) return;
    this.lightboxLockedBody = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.lightboxScrollY, behavior: 'instant' as ScrollBehavior });
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  openPlannerModal(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.showPlannerModal = true;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) { this.closeLightbox(); return; }
    if (this.showAllOpen) this.closeShowAll();
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
