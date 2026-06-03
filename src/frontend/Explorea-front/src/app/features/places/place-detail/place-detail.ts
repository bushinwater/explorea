import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  HostListener, inject, ChangeDetectorRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule, Location, NgStyle } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { PlaceDetail } from '../../../core/models/place.model';
import { PlaceService } from '../../../core/services/place.service';
import { PopularityService } from '../../../core/services/popularity.service';
import { AuthService } from '../../../core/services/auth.service';
import { SavedService } from '../../../core/services/saved.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { ReviewCard } from '../../../shared/components/review-card/review-card';
import { RatingStats } from '../../../shared/components/rating-stats/rating-stats';
import { ReviewsPanel } from '../../../shared/components/reviews-panel/reviews-panel';
import { ReviewModal } from '../../../shared/components/review-modal/review-modal';
import { ReviewDto } from '../../../core/models/home.model';
import { ShareButton } from '../../../shared/components/share-button/share-button';
import { AddToPlannerModal } from '../../../shared/components/add-to-planner-modal/add-to-planner-modal';

import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';

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
  selector: 'app-place-detail',
  standalone: true,
  imports: [
    CommonModule, NgStyle, RouterModule, TranslateModule,
    Sidebar, BottomNav,
    ReviewCard, RatingStats, ReviewsPanel, ReviewModal, ShareButton, AddToPlannerModal,
  ],
  templateUrl: './place-detail.html',
  styleUrl: './place-detail.css',
})
export class PlaceDetailComponent implements OnInit, OnDestroy {
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private placeService = inject(PlaceService);
  private popularityService = inject(PopularityService);
  private authService = inject(AuthService);
  private savedService = inject(SavedService);
  private cdr = inject(ChangeDetectorRef);

  place: PlaceDetail | null = null;
  loading = true;
  notFound = false;
  activeTab: 'details' | 'events' | 'reviews' = 'details';
  descriptionExpanded = false;

  isSaved = false;
  isSavedLoading = false;
  showPlannerModal = false;
  reviewsPanelOpen = false;
  reviewFormOpen = false;
  hasReviewed = false;
  currentUserId = '';

  lightboxOpen = false;
  lightboxIndex = 0;
  private lightboxScrollY = 0;
  private lightboxLockedBody = false;

  scrollProgress = 0;
  titleCaptured = false;
  private titleAbsTop = 0;
  private titleAbsLeft = 0;
  private scrollThreshold = 300;

  guests = 2;
  checkIn = '2024-08-15';
  checkOut = '2024-08-20';
  nights = 5;
  serviceFee = 45;

  private map?: MapLibreMap;
  private marker?: Marker;
  private mapInitialized = false;
  private lightStyle: any = null;
  private darkStyle: any = null;
  private themeObserver?: MutationObserver;
  private routeSub?: Subscription;

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollProgress = Math.min(window.scrollY / this.scrollThreshold, 1);
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
      this.loading = true;
      this.notFound = false;
      this.place = null;
      this.mapInitialized = false;
      this.activeTab = 'details';
      this.cdr.detectChanges();

      this.placeService.getBySlug(slug).subscribe({
        next: (data) => {
          this.place = data;
          this.loading = false;

          if (this.isValidGuid(data.id)) {
            this.popularityService.track('place', data.id);
            if (this.authService.isLoggedIn()) {
              this.savedService.check('place', data.id).subscribe(r => {
                this.isSaved = r.isSaved;
                this.cdr.detectChanges();
              });
            }
          }

          this.cdr.detectChanges();
          this.captureTitle();
          setTimeout(() => this.initMap(), 200);
        },
        error: (err) => {
          this.loading = false;
          this.notFound = err?.status === 404;
          this.cdr.detectChanges();
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.themeObserver?.disconnect();
    this.marker?.remove();
    this.map?.remove();
    this.unlockLightboxScroll();
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

  private ease(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private isValidGuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
    el.innerHTML = `
      <div class="pin-bubble"><span class="material-icons">place</span></div>
      <span class="pin-label">${this.place?.name ?? ''}</span>
    `;
    return el;
  }

  private async initMap(): Promise<void> {
    if (!this.mapContainer?.nativeElement || !this.place?.location || this.mapInitialized) return;
    this.mapInitialized = true;
    const { lat, lng } = this.place.location;

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
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    this.map.on('load', () => {
      this.marker = new maplibregl.Marker({ element: this.createPinElement(), anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(this.map!);
      this.cdr.detectChanges();
    });

    this.watchTheme();
  }

  private watchTheme(): void {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map) return;
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        if (this.place?.location) {
          const { lat, lng } = this.place.location;
          this.marker?.remove();
          this.marker = new maplibregl.Marker({ element: this.createPinElement(), anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(this.map!);
        }
      });
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  toggleSave(): void {
    if (!this.place || !this.isValidGuid(this.place.id)) return;
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.isSavedLoading = true;
    const action = this.isSaved
      ? this.savedService.unsave('place', this.place.id)
      : this.savedService.save('place', this.place.id);
    action.subscribe({
      next: () => {
        this.isSaved = !this.isSaved;
        this.isSavedLoading = false;
        setTimeout(() => this.cdr.detectChanges(), 0);
      },
      error: () => {
        this.isSavedLoading = false;
        setTimeout(() => this.cdr.detectChanges(), 0);
      },
    });
  }

  openReviewForm(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.reviewFormOpen = true;
    this.cdr.detectChanges();
  }

  onReviewSubmitted(review: ReviewDto): void {
    if (!this.place) return;
    const newReviews = [review as any, ...this.place.reviews];
    this.place = {
      ...this.place,
      reviews: newReviews,
      totalReviews: this.place.totalReviews + 1,
      avgRating: this.calcAvg(newReviews),
    };
    this.hasReviewed = true;
    this.reviewFormOpen = false;
    this.cdr.detectChanges();
  }

  onReviewDeleted(id: string): void {
    if (!this.place) return;
    const newReviews = this.place.reviews.filter((r: any) => r.id !== id);
    this.place = {
      ...this.place,
      reviews: newReviews,
      totalReviews: Math.max(0, this.place.totalReviews - 1),
      avgRating: this.calcAvg(newReviews),
    };
    this.hasReviewed = false;
    this.cdr.detectChanges();
  }

  onReviewUpdated(review: ReviewDto): void {
    if (!this.place) return;
    const idx = this.place.reviews.findIndex((r: any) => r.id === review.id);
    if (idx !== -1) {
      const updated = [...this.place.reviews];
      updated[idx] = { ...updated[idx], rating: review.rating, comment: review.comment };
      this.place = { ...this.place, reviews: updated, avgRating: this.calcAvg(updated) };
      this.cdr.detectChanges();
    }
  }

  private calcAvg(reviews: { rating: number }[]): number {
    if (!reviews.length) return 0;
    return Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10;
  }

  get stickyBarVisible(): boolean { return this.scrollProgress > 0.88; }

  get floatingTitleStyle(): Record<string, string> {
    if (!this.place || !this.titleCaptured) return { opacity: '0' };
    const p = this.ease(this.scrollProgress);
    const isMobile = window.innerWidth <= 768;
    const endX = isMobile ? 68 : 140;
    const endY = 20;
    const startViewportTop = this.titleAbsTop - window.scrollY;
    const startViewportLeft = this.titleAbsLeft;
    const tx = startViewportLeft + (endX - startViewportLeft) * p;
    const ty = startViewportTop + (endY - startViewportTop) * p;
    const baseSize = isMobile ? Math.max(20, Math.min(28, window.innerWidth * 0.055)) : 52;
    const endScale = (isMobile ? 16 : 17) / baseSize;
    const scale = 1 + (endScale - 1) * p;
    return {
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      opacity: '1',
    };
  }

  get heroTitleOpacity(): number  { return this.titleCaptured ? 0 : 1; }
  get heroBadgesOpacity(): number { return Math.max(1 - this.scrollProgress * 2, 0); }

  get subtotal(): number { return (this.place?.pricePerNight ?? 0) * this.nights; }
  get total(): number    { return this.subtotal + this.serviceFee; }

  get shortDescription(): string {
    const full = this.place?.description ?? '';
    return full.length > 300 ? full.slice(0, 300) + '…' : full;
  }

  get heroImage(): string {
    return this.place?.images?.[0]?.imageUrl ?? this.place?.previewImageUrl ?? '';
  }

  get galleryImages(): string[] {
    if (!this.place) return [];
    const imgs = this.place.images.map(i => i.imageUrl);
    if (imgs.length > 0) return imgs;
    return this.place.previewImageUrl ? [this.place.previewImageUrl] : [];
  }

  get locationText(): string {
    return this.place?.address ?? '';
  }

  get googleMapsDirectionsUrl(): string {
    if (!this.place?.location) return '';
    const { lat, lng } = this.place.location;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  get extraFiltersEntries(): { key: string; icon: string; labelKey: string }[] {
    const f = this.place?.extraFilters;
    if (!f) return [];
    const iconMap: Record<string, string> = {
      // DB format: has_* prefix
      has_wifi: 'wifi', has_parking: 'local_parking', has_pool: 'pool',
      has_breakfast: 'free_breakfast', has_pet_friendly: 'pets', has_air_conditioning: 'ac_unit',
      has_spa: 'spa', has_gym: 'fitness_center', has_restaurant: 'restaurant',
      has_room_service: 'room_service', has_bar: 'local_bar', has_elevator: 'elevator',
      // legacy camelCase keys (mock/old format)
      wifi: 'wifi', parking: 'local_parking', pool: 'pool',
      breakfast: 'free_breakfast', petFriendly: 'pets', airConditioning: 'ac_unit',
      spa: 'spa', gym: 'fitness_center', restaurant: 'restaurant',
      roomService: 'room_service', bar: 'local_bar', elevator: 'elevator',
    };
    const builtInKeys = new Set(Object.keys(iconMap));
    return Object.entries(f)
      .filter(([, v]) => v === true || (typeof v === 'string' && v))
      .map(([k]) => {
        const amenityName = k.replace(/^has_/, '').toUpperCase();
        const labelKey = builtInKeys.has(k)
          ? 'PLACE_DETAIL.AMENITIES.' + amenityName
          : k.replace(/^has_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { key: k, icon: iconMap[k] ?? 'check_circle', labelKey };
      });
  }

  get isAccommodation(): boolean {
    const name = (this.place?.type?.name ?? '').toLowerCase();
    return /hotel|motel|apartman|apartment|smeštaj|smestaj|hostel|vila|villa|resort|inn|lodge|pension|pansion/.test(name);
  }

  get placeReviews(): ReviewDto[] {
    return (this.place?.reviews ?? []) as unknown as ReviewDto[];
  }

  setTab(tab: 'details' | 'events' | 'reviews'): void { this.activeTab = tab; }
  toggleDescription(): void { this.descriptionExpanded = !this.descriptionExpanded; }

  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
    this.lockLightboxScroll();
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    this.unlockLightboxScroll();
  }

  lightboxNext(): void {
    const total = this.galleryImages.length;
    if (!total) return;
    this.lightboxIndex = (this.lightboxIndex + 1) % total;
  }

  lightboxPrev(): void {
    const total = this.galleryImages.length;
    if (!total) return;
    this.lightboxIndex = (this.lightboxIndex - 1 + total) % total;
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

  get currentLightboxImage(): string {
    return this.galleryImages[this.lightboxIndex] ?? '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) this.closeLightbox();
  }

  @HostListener('document:keydown.arrowLeft')
  onArrowLeft(): void {
    if (this.lightboxOpen) this.lightboxPrev();
  }

  @HostListener('document:keydown.arrowRight')
  onArrowRight(): void {
    if (this.lightboxOpen) this.lightboxNext();
  }

  incrementGuests(): void { this.guests++; }
  decrementGuests(): void { if (this.guests > 1) this.guests--; }
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
}
