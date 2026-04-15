import { CommonModule, Location, NgStyle } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { EventDetail } from '../../../core/models/event.model';
import { ReviewDto } from '../../../core/models/home.model';
import { EventService } from '../../../core/services/event.service';
import { AuthService } from '../../../core/services/auth.service';
import { SavedService } from '../../../core/services/saved.service';
import { ReviewService } from '../../../core/services/review.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { DetailFooter } from '../../../shared/components/detail-footer/detail-footer';
import { EventCard } from '../../../shared/components/event-card/event-card';
import { ImageGallery } from '../../../shared/components/image-gallery/image-gallery';
import { ReviewCard } from '../../../shared/components/review-card/review-card';
import { ReviewModal } from '../../../shared/components/review-modal/review-modal';
import { RatingStats } from '../../../shared/components/rating-stats/rating-stats';
import { ReviewsPanel } from '../../../shared/components/reviews-panel/reviews-panel';

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

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, NgStyle, RouterModule, TranslateModule, Sidebar, BottomNav, EventCard, ImageGallery, DetailFooter, ReviewCard, ReviewModal, RatingStats, ReviewsPanel],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.css',
})
export class EventDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('heroTitleEl') heroTitleEl!: ElementRef<HTMLElement>;

  event: EventDetail | null = null;
  loading = true;
  descriptionExpanded = false;
  persons = 1;

  isSaved = false;
  isSavedLoading = false;

  hasReviewed = false;
  reviewFormOpen = false;
  reviewsPanelOpen = false;
  private savedScrollY = 0;

  scrollProgress = 0;
  titleCaptured = false;
  private titleAbsTop = 0;
  private titleAbsLeft = 0;
  private scrollThreshold = 300;

  private map?: MapLibreMap;
  private marker?: Marker;
  private lightStyle: any;
  private darkStyle: any;
  private themeObserver?: MutationObserver;
  private mapInitialized = false;
  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private authService: AuthService,
    private savedService: SavedService,
    private reviewService: ReviewService,
    private location: Location,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
      this.loading = true;
      this.event = null;
      this.descriptionExpanded = false;
      this.mapInitialized = false;
      this.titleCaptured = false;
      this.scrollProgress = 0;
      this.hasReviewed = false;
      this.reviewFormOpen = false;
      this.reviewsPanelOpen = false;
      this.marker?.remove();
      this.map?.remove();
      this.map = undefined;
      this.eventService.getBySlug(slug).subscribe({
        next: data => {
          this.event = data;
          this.loading = false;
          window.scrollTo({ top: 0, behavior: 'auto' });
          this.cdr.detectChanges();
          this.captureTitle();
          if (this.authService.isLoggedIn()) {
            this.savedService.check('event', data.id).subscribe(res => {
              this.isSaved = res.isSaved;
              this.cdr.detectChanges();
            });
            this.reviewService.check('event', data.id).subscribe(res => {
              this.hasReviewed = res.hasReviewed;
              this.cdr.detectChanges();
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
    this.themeObserver?.disconnect();
    this.marker?.remove();
    this.map?.remove();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollProgress = Math.min(window.scrollY / this.scrollThreshold, 1);
    this.cdr.detectChanges();
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

  get floatingTitleStyle(): Record<string, string> {
    if (!this.event || !this.titleCaptured) return { opacity: '0' };
    const p = this.ease(this.scrollProgress);
    const isMobile = window.innerWidth <= 768;
    const endX = isMobile ? 16 : 88;
    const startViewportTop = this.titleAbsTop - window.scrollY;
    const startViewportLeft = this.titleAbsLeft;
    const tx = startViewportLeft + (endX - startViewportLeft) * p;
    const ty = startViewportTop + (16 - startViewportTop) * p;
    const baseSize = isMobile ? 34 : 52;
    const scale = 1 + (17 / baseSize - 1) * p;
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
    return this.scrollProgress > 0.88 && !this.loading && !!this.event;
  }

  get avgRating(): number {
    const reviews = this.event?.reviews;
    if (!reviews?.length) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }

  get reviewsAsDto(): ReviewDto[] {
    return this.event?.reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? '',
      createdAt: r.createdAt,
      user: {
        id: '',
        firstName: r.authorName,
        lastName: '',
        travelerRank: 'Putnik',
        profileImageUrl: r.authorAvatarUrl,
      },
    })) ?? [];
  }

  openReviewForm(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.reviewFormOpen = true;
  }

  onReviewSubmitted(review: ReviewDto): void {
    if (!this.event) return;
    this.event.reviews.unshift({
      id: review.id,
      rating: review.rating,
      comment: review.comment ?? null,
      authorName: `${review.user.firstName} ${review.user.lastName}`.trim(),
      authorAvatarUrl: review.user.profileImageUrl ?? null,
      createdAt: review.createdAt,
    });
    this.hasReviewed = true;
    this.cdr.detectChanges();
  }

  openReviewsPanel(): void {
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    this.reviewsPanelOpen = true;
  }

  closeReviewsPanel(): void {
    this.reviewsPanelOpen = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.savedScrollY, behavior: 'instant' as ScrollBehavior });
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

  private buildThemedStyle(base: any, p: typeof DARK): any {
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
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id))
            { fillColor = p.water; layer.paint['fill-outline-color'] = p.water; }
          else if (/forest|wood|orchard|scrub|grass|meadow|park|nature|garden|vegetation|landcover|landuse/.test(id))
            { fillColor = p.park; }
          else if (/sand|beach|desert|bare/.test(id))
            { fillColor = p.sand; }
          else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id))
            { fillColor = p.pedestrian; }
          else if (/bridge/.test(id))
            { fillColor = p.bridge; }
          else {
            const orig = typeof layer.paint['fill-color'] === 'string' ? layer.paint['fill-color'] : '';
            fillColor = this.luminance(orig) > 128 ? p.surface : p.land;
          }
          layer.paint['fill-color'] = fillColor; break;
        }
        case 'line': {
          let lineColor: string;
          if (/water|river|stream|canal|lake/.test(id)) lineColor = p.water;
          else if (/motorway|trunk/.test(id)) lineColor = p.road_major;
          else if (/primary|secondary|tertiary|road|street|residential|service/.test(id)) lineColor = p.road_minor;
          else if (/path|track|foot|cycle|pedestrian/.test(id)) lineColor = p.road_path;
          else if (/boundary|admin|border/.test(id)) lineColor = p.boundary;
          else if (/bridge/.test(id)) lineColor = p.bridge;
          else if (/casing|outline/.test(id)) lineColor = p.land;
          else {
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

  private watchTheme(): void {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map) return;
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (!style) return;
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        if (this.event?.location) {
          const { lat, lng } = this.event.location;
          this.marker?.remove();
          this.marker = new maplibregl.Marker({ element: this.createPinElement(), anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(this.map!);
        }
      });
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    });
  }

  private async initMap(): Promise<void> {
    if (this.mapInitialized || !this.mapContainer?.nativeElement || !this.event?.location) return;
    const { lat, lng } = this.event.location;
    this.mapInitialized = true;

    const res = await fetch(MAP_STYLE_URL);
    const base = await res.json();
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle  = this.buildThemedStyle(base, DARK);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: [lng, lat],
      zoom: 13,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    this.map.on('load', () => {
      this.marker = new maplibregl.Marker({ element: this.createPinElement(), anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(this.map!);
      this.cdr.detectChanges();
    });

    this.watchTheme();
  }

  toggleSave(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (!this.event || this.isSavedLoading) return;
    this.isSavedLoading = true;
    const action = this.isSaved
      ? this.savedService.unsave('event', this.event.id)
      : this.savedService.save('event', this.event.id);
    action.subscribe({
      next: () => { this.isSaved = !this.isSaved; this.isSavedLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isSavedLoading = false; this.cdr.detectChanges(); },
    });
  }

  get heroImage(): string {
    return this.event?.images?.[0]?.imageUrl ?? this.event?.previewImageUrl ?? '';
  }

  get shortDescription(): string {
    const desc = this.event?.description ?? '';
    if (desc.length <= 200) return desc;
    return desc.slice(0, 200) + '…';
  }

  get formattedDateRange(): string {
    if (!this.event) return '';
    const start = new Date(this.event.startDatetime);
    const end = new Date(this.event.endDatetime);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    const startStr = start.toLocaleDateString('sr-Latn-RS', opts);
    const endStr = end.toLocaleDateString('sr-Latn-RS', opts);
    if (startStr === endStr) return startStr;
    return `${startStr} – ${endStr}`;
  }

  get formattedTimeRange(): string {
    if (!this.event) return '';
    const start = new Date(this.event.startDatetime);
    const end = new Date(this.event.endDatetime);
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    return `${start.toLocaleTimeString('sr-Latn-RS', timeOpts)} – ${end.toLocaleTimeString('sr-Latn-RS', timeOpts)}`;
  }

  get locationText(): string {
    if (!this.event) return '';
    return [this.event.address, this.event.city?.name].filter(Boolean).join(', ');
  }

  get formattedDayNames(): string {
    if (!this.event) return '';
    const days = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
    const start = new Date(this.event.startDatetime);
    const end = new Date(this.event.endDatetime);
    const startDay = days[start.getDay()];
    const endDay = days[end.getDay()];
    if (startDay === endDay) return startDay;
    return `${startDay} – ${endDay}`;
  }

  get googleMapsUrl(): string {
    const loc = this.event?.location;
    if (!loc) return 'https://maps.google.com';
    return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  }

  get googleMapsDirectionsUrl(): string {
    const loc = this.event?.location;
    if (!loc) return 'https://maps.google.com';
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
  }

  private createPinElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'map-pin-btn';
    el.innerHTML = `<div class="pin-bubble"><span class="material-icons">event</span></div>`;
    return el;
  }

  buyTickets(): void {
    if (this.event?.ticketUrl) window.open(this.event.ticketUrl, '_blank');
  }

  goBack(): void {
    this.location.back();
  }

  navigateToEvents(): void {
    this.router.navigate(['/events']);
  }

  incrementPersons(): void {
    this.persons++;
  }

  decrementPersons(): void {
    if (this.persons > 1) this.persons--;
  }
}
