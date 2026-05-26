import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StatCardComponent } from '@shared/components';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  AmenityOption,
  CountryOption,
  InterestTagOption,
  PlaceDetail,
  PlaceFilters,
  PlaceReview,
  PlaceRow,
  PlaceStats,
  PlaceStatus,
  PlaceTypeOption,
  RegionOption,
} from './admin-places.models';
import { AdminPlacesService } from './admin-places.service';
import { PlaceCreateModalComponent } from './admin-place-create-modal.component';
import { PlaceEditModalComponent } from './admin-place-edit-modal.component';
import { MapPreviewComponent } from '../shared/components/map-preview/map-preview.component';

@Component({
  selector: 'app-admin-places-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    MapPreviewComponent,
    TableSkeletonComponent,
    PlaceCreateModalComponent,
    PlaceEditModalComponent,
  ],
  templateUrl: './admin-places-page.component.html',
  styleUrl: './admin-places-page.component.css',
})
export class AdminPlacesPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<PlaceFilters>({
    search: '',
    typeId: 'all',
    status: 'all',
    regionId: 'all',
    minRating: null,
    amenityId: null,
    page: 1,
    pageSize: 20,
  });

  protected readonly places    = signal<PlaceRow[]>([]);
  protected readonly listMode  = signal<'active' | 'deleted'>('active');
  protected readonly stats     = signal<PlaceStats | null>(null);
  protected readonly types     = signal<PlaceTypeOption[]>([]);
  protected readonly regions   = signal<RegionOption[]>([]);
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly amenities = signal<AmenityOption[]>([]);
  protected readonly hoverRating = signal<number | null>(null);
  protected readonly total     = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading    = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen   = signal(false);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isDeleting     = signal(false);
  protected readonly isRestoring    = signal(false);
  protected readonly isEditModalOpen   = signal(false);
  protected readonly isCreateModalOpen = signal(false);
  protected readonly selectedPlace  = signal<PlaceRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage   = signal('');

  protected readonly isDetailsPanelOpen  = signal(false);
  protected readonly isPanelClosing      = signal(false);
  protected readonly isDetailLoading     = signal(false);
  protected readonly detailsPanelRow     = signal<PlaceRow | null>(null);
  protected readonly detailsPanelDetail  = signal<PlaceDetail | null>(null);
  protected readonly detailsPanelInterests = signal<InterestTagOption[]>([]);
  protected readonly detailsPanelReviews   = signal<PlaceReview[]>([]);
  protected readonly descriptionExpanded = signal(false);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.authContext.context().role === 'super_admin',
  );

  protected readonly canSeeRegionFilter = computed(() => {
    const role = this.authContext.context().role;
    return role === 'super_admin' || role === 'tourist_organization';
  });

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.typeId !== 'all',
      f.status !== 'all',
      f.regionId !== 'all',
      f.minRating !== null,
      f.amenityId !== null,
    ].filter(Boolean).length;
  });

  protected readonly statuses: Array<{ value: PlaceStatus | 'all'; label: string }> = [
    { value: 'all',      label: 'Svi statusi' },
    { value: 'approved', label: 'Aktivno' },
    { value: 'pending',  label: 'Na čekanju' },
    { value: 'inactive', label: 'Neaktivno' },
    { value: 'rejected', label: 'Odbijeno' },
  ];

  protected readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private readonly placesService: AdminPlacesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        const q = value.trim();
        this.patchFilter({ search: value, page: 1 });
        if (!q) {
          this.loadPlaces();
          return;
        }
        this.loadPlacesFuzzy(q);
      }),
    );

    this.loadStats();
    this.loadTypes();
    this.loadRegions();
    this.loadCountries();
    const openEditId = (history.state as { openEditId?: string })?.openEditId ?? null;
    this.loadPlaces(openEditId ? (items) => {
      const place = items.find(p => p.id === openEditId);
      if (place) this.openEdit(place);
    } : undefined);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyType(typeId: number | 'all'): void {
    this.amenities.set([]);
    this.patchFilter({ typeId, amenityId: null, page: 1 });
    this.loadPlaces();
    if (typeId !== 'all') this.loadAmenities(typeId);
  }

  protected applyAmenity(amenityId: number | null): void {
    const current = this.filters().amenityId;
    this.patchFilter({ amenityId: amenityId === current ? null : amenityId, page: 1 });
    this.loadPlaces();
  }

  protected applyStatus(value: PlaceStatus | 'all'): void {
    this.patchFilter({ status: value, page: 1 });
    this.loadPlaces();
  }

  protected applyRegion(regionId: number | 'all'): void {
    this.patchFilter({ regionId, page: 1 });
    this.loadPlaces();
  }

  protected applyMinRating(value: number): void {
    const current = this.filters().minRating;
    this.patchFilter({ minRating: current === value ? null : value, page: 1 });
    this.loadPlaces();
  }

  protected resetFilters(): void {
    this.amenities.set([]);
    this.hoverRating.set(null);
    this.filters.update((f) => ({
      search: '',
      typeId: 'all',
      status: 'all',
      regionId: 'all',
      minRating: null,
      amenityId: null,
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
    this.loadPlaces();
  }

  protected setListMode(mode: 'active' | 'deleted'): void {
    if (this.listMode() === mode) return;
    this.listMode.set(mode);
    this.closeDetailsPanel();
    this.patchFilter({ page: 1 });
    this.currentPage.set(1);
    this.loadPlaces();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadPlaces();
  }

  protected openCreateModal(): void {
    if (this.listMode() === 'deleted') return;
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  protected onPlaceCreated(detail: PlaceDetail): void {
    this.successMessage.set(`„${detail.name}" je uspešno kreiran.`);
    this.closeCreateModal();
    this.loadPlaces();
    this.loadStats();
  }

  protected openEdit(row: PlaceRow): void {
    this.selectedPlace.set(row);
    this.isEditModalOpen.set(true);
  }

  protected openEditFromPanel(): void {
    const row = this.detailsPanelRow();
    if (!row) return;
    this.openEdit(row);
  }

  protected closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedPlace.set(null);
  }

  protected onEditSaved(detail: PlaceDetail): void {
    this.successMessage.set(`„${detail.name}" je uspešno ažuriran.`);
    this.closeEditModal();
    if (this.isDetailsPanelOpen() && this.detailsPanelRow()?.id === detail.id) {
      this.subscription.add(
        this.placesService.getById(detail.id).subscribe({
          next: (d) => this.detailsPanelDetail.set(d),
        }),
      );
    }
    this.loadPlaces();
    this.loadStats();
  }

  protected restorePlace(place: PlaceRow): void {
    this.isRestoring.set(true);
    this.subscription.add(
      this.placesService.restorePlace(place.id).subscribe({
        next: () => {
          this.isRestoring.set(false);
          this.successMessage.set(`„${place.name}" je uspešno vraćen.`);
          this.closeDetailsPanel();
          this.loadPlaces();
        },
        error: () => {
          this.isRestoring.set(false);
          this.errorMessage.set('Greška pri vraćanju mesta.');
        },
      }),
    );
  }

  protected openDetailsPanel(place: PlaceRow): void {

    this.detailsPanelRow.set(place);
    this.detailsPanelDetail.set(null);
    this.detailsPanelInterests.set([]);
    this.isDetailsPanelOpen.set(true);
    this.isDetailLoading.set(true);
    this.descriptionExpanded.set(false);

    this.subscription.add(
      this.placesService.getById(place.id).subscribe({
        next: (detail) => {
          this.detailsPanelDetail.set(detail);
          this.isDetailLoading.set(false);
        },
        error: () => {
          this.isDetailLoading.set(false);
        },
      }),
    );

    this.subscription.add(
      this.placesService.getPlaceInterests(place.id).subscribe({
        next: tags => this.detailsPanelInterests.set(tags.filter(t => t.isAssigned)),
        error: () => {},
      }),
    );

    this.subscription.add(
      this.placesService.getPlaceReviews(place.id).subscribe({
        next: reviews => this.detailsPanelReviews.set(reviews),
        error: () => this.detailsPanelReviews.set([]),
      }),
    );
  }

  protected closeDetailsPanel(): void {
    if (this.isPanelClosing()) return;
    this.isPanelClosing.set(true);
    setTimeout(() => {
      this.isDetailsPanelOpen.set(false);
      this.isPanelClosing.set(false);
      this.detailsPanelRow.set(null);
      this.detailsPanelDetail.set(null);
      this.detailsPanelInterests.set([]);
      this.detailsPanelReviews.set([]);
    }, 220);
  }

  protected openDeleteDialog(place: PlaceRow): void {
    this.selectedPlace.set(place);
    this.isDeleteDialogOpen.set(true);
  }

  protected openDeleteFromPanel(): void {
    const row = this.detailsPanelRow();
    if (!row) return;
    this.closeDetailsPanel();
    this.openDeleteDialog(row);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.selectedPlace.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const place = this.selectedPlace();
    if (!place) return;

    this.isDeleting.set(true);

    this.subscription.add(
      this.placesService.delete(place.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.selectedPlace.set(null);
          this.successMessage.set(`„${place.name}" je uspešno uklonjen.`);
          this.loadPlaces();
          this.loadStats();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set('Greška pri brisanju objekta.');
        },
      }),
    );
  }

  protected timeAgo(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `pre ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `pre ${hours} h`;
    const days = Math.floor(hours / 24);
    return `pre ${days} dana`;
  }

  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('sr-Latn-RS', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  protected formatRating(r: number): string {
    return r.toFixed(1);
  }

  protected statusLabel(status: PlaceStatus): string {
    const map: Record<PlaceStatus, string> = {
      approved: 'Aktivno',
      pending:  'Na čekanju',
      inactive: 'Neaktivno',
      rejected: 'Odbijeno',
    };
    return map[status] ?? status;
  }

  protected placeIcon(typeName: string | null): string {
    const n = typeName?.toLowerCase() ?? '';
    if (n.includes('hotel') || n.includes('hostel') || n.includes('smešt')) return 'hotel';
    if (n.includes('restoran') || n.includes('restaurant')) return 'restaurant';
    if (n.includes('kafić') || n.includes('cafe') || n.includes('kafe')) return 'local_cafe';
    if (n.includes('bar') || n.includes('pub') || n.includes('lounge')) return 'sports_bar';
    if (n.includes('muzej') || n.includes('museum')) return 'museum';
    if (n.includes('galerij') || n.includes('gallery')) return 'image';
    if (n.includes('park') || n.includes('priroda')) return 'park';
    if (n.includes('wellness') || n.includes('spa')) return 'spa';
    if (n.includes('shopping') || n.includes('tržni')) return 'shopping_bag';
    return 'storefront';
  }

  protected placeThumbColor(typeName: string | null): string {
    const n = typeName?.toLowerCase() ?? '';
    if (n.includes('hotel') || n.includes('hostel')) return '#1e4d7b';
    if (n.includes('restoran') || n.includes('restaurant')) return '#8b3a2a';
    if (n.includes('kafić') || n.includes('cafe')) return '#5c4033';
    if (n.includes('muzej') || n.includes('museum')) return '#4a3060';
    if (n.includes('galerij')) return '#2d4a6b';
    if (n.includes('park')) return '#1f5c3a';
    if (n.includes('wellness') || n.includes('spa')) return '#2d6b6b';
    return '#3a5a6b';
  }

  protected starArray(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  protected visibleRangeText(): string {
    const total = this.total();
    if (!total) return '';
    const page = this.currentPage();
    const size = this.filters().pageSize;
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `Prikazano ${from}–${to} od ${total}`;
  }

  protected pageNumbers(): number[] {
    const total = this.totalPages();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const current = this.currentPage();
    const pages = new Set([1, total, current, current - 1, current + 1]);
    return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.isFilterOpen.set(false);
    if (this.isDetailsPanelOpen() && !this.isPanelClosing()) {
      const target = event.target as Element;
      if (!target.closest('.ddp-panel') && !target.closest('.place-card')) {
        this.closeDetailsPanel();
      }
    }
  }

  private patchFilter(patch: Partial<PlaceFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
  }

  private loadPlaces(afterLoad?: (items: PlaceRow[]) => void): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const request = this.listMode() === 'deleted'
      ? this.placesService.getDeletedPlaces(this.filters())
      : this.placesService.getPlaces(this.filters());

    this.subscription.add(
      request.subscribe({
        next: (response) => {
          this.places.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
          afterLoad?.(response.items);
        },
        error: () => {
          this.places.set([]);
          this.total.set(0);
          this.errorMessage.set('Greška pri učitavanju objekata.');
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadPlacesFuzzy(query: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const allFilters = { ...this.filters(), search: '', page: 1, pageSize: 500 };

    this.subscription.add(
      this.placesService.getPlaces(allFilters).subscribe({
        next: (response) => {
          const q = query.toLowerCase();
          const matched = response.items.filter(p =>
            this.fuzzyMatch(p.name.toLowerCase(), q) ||
            (p.city && this.fuzzyMatch(p.city.toLowerCase(), q)) ||
            (p.region && this.fuzzyMatch(p.region.toLowerCase(), q)) ||
            (p.type && this.fuzzyMatch(p.type.toLowerCase(), q)) ||
            (p.destination && this.fuzzyMatch(p.destination.toLowerCase(), q)),
          );
          this.places.set(matched);
          this.total.set(matched.length);
          this.isLoading.set(false);
        },
        error: () => {
          this.places.set([]);
          this.total.set(0);
          this.errorMessage.set('Greška pri učitavanju objekata.');
          this.isLoading.set(false);
        },
      }),
    );
  }

  private fuzzyMatch(text: string, query: string): boolean {
    if (text.includes(query)) return true;
    if (query.length < 3) return false;

    for (let i = 0; i < query.length - 1; i++) {
      const swapped = query.slice(0, i) + query[i + 1] + query[i] + query.slice(i + 2);
      if (text.includes(swapped)) return true;
    }

    if (query.length >= 4) {
      for (let i = 0; i < query.length; i++) {
        const shortened = query.slice(0, i) + query.slice(i + 1);
        if (text.includes(shortened)) return true;
      }
    }

    return false;
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.subscription.add(
      this.placesService.getStats().subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.isStatsLoading.set(false);
        },
        error: () => this.isStatsLoading.set(false),
      }),
    );
  }

  private loadTypes(): void {
    this.subscription.add(
      this.placesService.getTypes().subscribe({
        next: (types) => this.types.set(types),
      }),
    );
  }

  private loadRegions(): void {
    this.subscription.add(
      this.placesService.getRegions().subscribe({
        next: (regions) => this.regions.set(regions),
      }),
    );
  }

  private loadCountries(): void {
    this.subscription.add(
      this.placesService.getCountries().subscribe({
        next: (countries) => this.countries.set(countries),
      }),
    );
  }

  private loadAmenities(typeId: number): void {
    this.subscription.add(
      this.placesService.getAmenities(typeId).subscribe({
        next: (amenities) => this.amenities.set(amenities),
      }),
    );
  }
}
