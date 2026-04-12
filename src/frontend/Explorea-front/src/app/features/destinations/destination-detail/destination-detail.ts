import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef, HostListener, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

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

import { DestinationService } from '../../../core/services/destination.service';
import { AuthService } from '../../../core/services/auth.service';
import { SavedService } from '../../../core/services/saved.service';
import { ReviewService } from '../../../core/services/review.service';
import {
  ActivityCard,
  DestinationDetail,
  EventCard,
  PlaceCard
} from '../../../core/models/destination.model';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { ReviewCard } from '../../../shared/components/review-card/review-card';
import { ReviewModal } from '../../../shared/components/review-modal/review-modal';
import { DetailFooter } from '../../../shared/components/detail-footer/detail-footer';
import { RatingStats } from '../../../shared/components/rating-stats/rating-stats';
import { ReviewsPanel } from '../../../shared/components/reviews-panel/reviews-panel';
import { ReviewDto } from '../../../core/models/home.model';

type DetailTab = 'places' | 'events' | 'activities' | 'reviews';
type TabItem = PlaceCard | EventCard | ActivityCard;

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [CommonModule, NgStyle, RouterModule, TranslateModule, Sidebar, BottomNav, ReviewCard, ReviewModal, DetailFooter, RatingStats, ReviewsPanel],
  templateUrl: './destination-detail.html',
  styleUrls: ['./destination-detail.css']
})
export class DestinationDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private destinationService = inject(DestinationService);
  private authService = inject(AuthService);
  private savedService = inject(SavedService);
  private reviewService = inject(ReviewService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  private routeSub?: Subscription;
  private requestSub?: Subscription;

  private map?: MapLibreMap;
  private marker?: Marker;
  private mapInitialized = false;
  private lightStyle: any = null;
  private darkStyle: any = null;
  private themeObserver?: MutationObserver;

  destination: DestinationDetail | null = null;
  isLoading = true;
  error: string | null = null;
  selectedTab: DetailTab = 'places';

  lightboxOpen = false;
  selectedImageIndex = 0;

  isSaved = false;
  isSavedLoading = false;

  showAllOpen = false;
  reviewsPanelOpen = false;
  private savedScrollY = 0;

  hasReviewed = false;
  reviewFormOpen = false;

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
    this.marker?.remove();
    this.map?.remove();
    this.themeObserver?.disconnect();
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
    this.mapInitialized = false;
    this.marker?.remove();
    this.map?.remove();
    this.map = undefined;
    this.cdr.detectChanges();

    this.requestSub = this.destinationService.getDestinationBySlug(slug).subscribe({
      next: (data) => {
        this.destination = data;
        this.isLoading = false;
        this.isSaved = false;
        this.hasReviewed = false;
        window.scrollTo({ top: 0, behavior: 'auto' });
        this.cdr.detectChanges();
        this.captureTitle();
        setTimeout(() => this.initMap(), 100);
        if (this.authService.isLoggedIn()) {
          this.savedService.check('destination', data.id).subscribe({
            next: (res) => { this.isSaved = res.isSaved; this.cdr.detectChanges(); },
          });
          this.reviewService.check('destination', data.id).subscribe({
            next: (res) => { this.hasReviewed = res.hasReviewed; this.cdr.detectChanges(); },
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
    if (this.selectedTab === 'reviews') {
      this.reviewsPanelOpen = true;
    } else {
      this.showAllOpen = true;
    }
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
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
    this.reviewFormOpen = true;
  }

  onReviewSubmitted(review: ReviewDto): void {
    if (!this.destination) return;
    this.destination.reviews.unshift({
      id: review.id,
      rating: review.rating,
      comment: review.comment ?? '',
      createdAt: review.createdAt,
      user: {
        id: review.user.id,
        firstName: review.user.firstName,
        lastName: review.user.lastName,
        travelerRank: review.user.travelerRank,
      },
    });
    this.hasReviewed = true;
    this.cdr.detectChanges();
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

  get googleMapsDirectionsUrl(): string {
    const lat = this.destination?.location?.lat;
    const lng = this.destination?.location?.lng;
    if (lat == null || lng == null) return 'https://maps.google.com';
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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
    el.innerHTML = `<div class="pin-bubble"><span class="material-icons">location_on</span></div>`;
    return el;
  }

  private watchTheme(): void {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map) return;
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        if (this.destination?.location) {
          const { lat, lng } = this.destination.location;
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
    if (this.mapInitialized || !this.mapContainer || !this.destination?.location) return;
    const { lat, lng } = this.destination.location;
    this.mapInitialized = true;

    const res = await fetch(MAP_STYLE_URL);
    const base = await res.json();
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle = this.buildThemedStyle(base, DARK);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [lng, lat],
      zoom: 12,
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

      const attrib = this.mapContainer?.nativeElement.querySelector('.maplibregl-ctrl-attrib');
      attrib?.classList.remove('maplibregl-compact-show');

      this.cdr.detectChanges();
    });

    this.watchTheme();
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

  goBack(): void {
    this.location.back();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) this.closeLightbox();
    else if (this.showAllOpen) this.closeShowAll();
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