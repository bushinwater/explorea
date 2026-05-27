import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import {
  EmptyStateComponent,
  FeedbackBannerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  TableSkeletonComponent,
} from '@shared/components';
import {
  EntityType,
  ReviewFilters,
  ReviewRow,
  ReviewStats,
  ReviewVisibility,
} from './admin-reviews.models';
import { AdminReviewsService } from './admin-reviews.service';

interface LookupOption { id: number; name: string; }

@Component({
  selector: 'app-admin-reviews-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    EmptyStateComponent,
    TableSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-reviews-page.component.html',
  styleUrl: './admin-reviews-page.component.css',
})
export class AdminReviewsPageComponent implements OnInit, OnDestroy {
  private readonly subscription = new Subscription();

  protected readonly filters = signal<ReviewFilters>({
    entityType: 'all',
    subtypeId: null,
    regionId: null,
    cityId: null,
    minRating: null,
    maxRating: null,
    visibility: 'all',
    page: 1,
    pageSize: 10,
  });

  protected readonly reviews = signal<ReviewRow[]>([]);
  protected readonly stats = signal<ReviewStats | null>(null);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen = signal(false);
  protected readonly filterPanelTop = signal(0);
  protected readonly filterPanelRight = signal(0);
  protected readonly activeMenuId = signal<string | null>(null);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly isReplyDialogOpen = signal(false);
  protected readonly isReplying = signal(false);
  protected readonly replyText = signal('');
  protected readonly isActionLoading = signal(false);
  protected readonly selectedReview = signal<ReviewRow | null>(null);
  protected readonly deleteReason = signal('');
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  // Lookup data za filtere
  protected readonly regions = signal<LookupOption[]>([]);
  protected readonly cities = signal<LookupOption[]>([]);
  protected readonly subtypes = signal<LookupOption[]>([]);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.dashboardAuth.role() === 'super_admin',
  );

  protected readonly isTouristOrg = computed(
    () => this.dashboardAuth.role() === 'tourist_organization',
  );

  protected readonly isPlaceOwner = computed(
    () => this.dashboardAuth.role() === 'place_owner',
  );

  protected readonly canHideApprove = computed(
    () => this.isSuperAdmin() || this.isTouristOrg(),
  );

  protected readonly showActionsMenu = computed(() => true);
  protected readonly showEntityTypeFilter = computed(() => !this.isPlaceOwner());
  protected readonly showVisibilityFilter = computed(() => !this.isPlaceOwner());
  protected readonly showRegionFilter = computed(() => this.isSuperAdmin());

  protected readonly showSubtypeFilter = computed(() => {
    const et = this.filters().entityType;
    return et === 'activity' || et === 'event' || et === 'place';
  });

  protected readonly subtypeLabel = computed(() => {
    const et = this.filters().entityType;
    if (et === 'activity') return 'Kategorija aktivnosti';
    if (et === 'event') return 'Tip događaja';
    if (et === 'place') return 'Tip objekta';
    return 'Podtip';
  });

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.entityType !== 'all',
      f.subtypeId !== null,
      f.minRating !== null,
      f.maxRating !== null,
      f.visibility !== 'all',
      f.regionId !== null,
      f.cityId !== null,
    ].filter(Boolean).length;
  });

  protected readonly avgRatingLabel = computed(() => {
    const avg = this.stats()?.avgRating ?? 0;
    return avg > 0 ? `${avg.toFixed(1)} / 5.0` : '—';
  });

  protected readonly entityTypes: Array<{ value: EntityType | 'all'; labelKey: string }> = [
    { value: 'all', labelKey: 'reviews.filter.entity.all' },
    { value: 'destination', labelKey: 'reviews.filter.entity.destination' },
    { value: 'activity', labelKey: 'reviews.filter.entity.activity' },
    { value: 'place', labelKey: 'reviews.filter.entity.place' },
    { value: 'event', labelKey: 'reviews.filter.entity.event' },
  ];

  protected readonly visibilityOptions: Array<{ value: ReviewVisibility; labelKey: string }> = [
    { value: 'all', labelKey: 'reviews.filter.visibility.all' },
    { value: 'visible', labelKey: 'reviews.filter.visibility.visible' },
    { value: 'hidden', labelKey: 'reviews.filter.visibility.hidden' },
  ];

  constructor(
    private readonly reviewsService: AdminReviewsService,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly dashboardAuth: DashboardAuthService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadReviews();
    if (this.isSuperAdmin()) {
      this.loadRegions();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected toggleFilter(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isFilterOpen()) {
      this.isFilterOpen.set(false);
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.filterPanelTop.set(rect.bottom + 6);
    this.filterPanelRight.set(window.innerWidth - rect.right);
    this.isFilterOpen.set(true);
  }

  protected applyEntityType(value: EntityType | 'all'): void {
    this.patchFilter({ entityType: value, subtypeId: null, page: 1 });
    this.subtypes.set([]);
    if (value !== 'all' && value !== 'destination') {
      this.loadSubtypes(value);
    }
    this.loadReviews();
  }

  protected applySubtype(rawValue: string): void {
    this.patchFilter({ subtypeId: rawValue ? +rawValue : null, page: 1 });
    this.loadReviews();
  }

  protected applyRegion(rawValue: string): void {
    const regionId = rawValue ? +rawValue : null;
    this.patchFilter({ regionId, cityId: null, page: 1 });
    this.cities.set([]);
    if (regionId !== null) {
      this.loadCities(regionId);
    }
    this.loadReviews();
  }

  protected applyCity(rawValue: string): void {
    this.patchFilter({ cityId: rawValue ? +rawValue : null, page: 1 });
    this.loadReviews();
  }

  protected applyMinRating(rawValue: string): void {
    this.patchFilter({ minRating: rawValue ? +rawValue : null, page: 1 });
    this.loadReviews();
  }

  protected applyMaxRating(rawValue: string): void {
    this.patchFilter({ maxRating: rawValue ? +rawValue : null, page: 1 });
    this.loadReviews();
  }

  protected applyVisibility(value: ReviewVisibility): void {
    this.patchFilter({ visibility: value, page: 1 });
    this.loadReviews();
  }

  protected resetFilters(): void {
    this.filters.update((f) => ({
      entityType: 'all',
      subtypeId: null,
      regionId: null,
      cityId: null,
      minRating: null,
      maxRating: null,
      visibility: 'all',
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
    this.cities.set([]);
    this.subtypes.set([]);
    this.loadReviews();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadReviews();
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.update((current) => (current === id ? null : id));
  }

  protected hideReview(review: ReviewRow): void {
    this.activeMenuId.set(null);
    this.isActionLoading.set(true);
    this.errorMessage.set('');
    this.subscription.add(
      this.reviewsService.hide(review.id).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.successMessage.set(this.ui.t('reviews.success.hidden'));
          this.loadReviews();
          this.loadStats();
        },
        error: () => {
          this.isActionLoading.set(false);
          this.errorMessage.set(this.ui.t('reviews.error.action'));
        },
      }),
    );
  }

  protected approveReview(review: ReviewRow): void {
    this.activeMenuId.set(null);
    this.isActionLoading.set(true);
    this.errorMessage.set('');
    this.subscription.add(
      this.reviewsService.approve(review.id).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.successMessage.set(this.ui.t('reviews.success.approved'));
          this.loadReviews();
          this.loadStats();
        },
        error: () => {
          this.isActionLoading.set(false);
          this.errorMessage.set(this.ui.t('reviews.error.action'));
        },
      }),
    );
  }

  protected openDeleteDialog(review: ReviewRow): void {
    this.activeMenuId.set(null);
    this.selectedReview.set(review);
    this.deleteReason.set('');
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.selectedReview.set(null);
    this.deleteReason.set('');
    this.isDeleteDialogOpen.set(false);
  }

  protected openReplyDialog(review: ReviewRow): void {
    this.activeMenuId.set(null);
    this.selectedReview.set(review);
    this.replyText.set(review.ownerReply ?? '');
    this.isReplyDialogOpen.set(true);
  }

  protected closeReplyDialog(): void {
    this.isReplying.set(false);
    this.selectedReview.set(null);
    this.replyText.set('');
    this.isReplyDialogOpen.set(false);
  }

  protected confirmReply(): void {
    const review = this.selectedReview();
    if (!review || !this.replyText().trim()) return;

    this.isReplying.set(true);
    this.subscription.add(
      this.reviewsService.reply(review.id, this.replyText().trim()).subscribe({
        next: (res) => {
          this.isReplying.set(false);
          this.isReplyDialogOpen.set(false);
          this.reviews.update((list) =>
            list.map((r) =>
              r.id === review.id
                ? { ...r, ownerReply: res.ownerReply, ownerReplyAt: res.ownerReplyAt }
                : r,
            ),
          );
          this.successMessage.set('Odgovor je uspešno sačuvan.');
          this.selectedReview.set(null);
          this.replyText.set('');
        },
        error: () => {
          this.isReplying.set(false);
          this.errorMessage.set(this.ui.t('reviews.error.action'));
        },
      }),
    );
  }

  protected confirmDelete(): void {
    const review = this.selectedReview();
    if (!review) return;

    this.isDeleting.set(true);
    this.subscription.add(
      this.reviewsService.delete(review.id, this.deleteReason() || undefined).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.selectedReview.set(null);
          this.deleteReason.set('');
          this.successMessage.set(this.ui.t('reviews.success.deleted'));
          this.loadReviews();
          this.loadStats();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set(this.ui.t('reviews.error.action'));
        },
      }),
    );
  }

  protected navigateToAdminEntity(review: ReviewRow): void {
    const routeMap: Record<EntityType, string> = {
      destination: '/admin/destinations',
      place: '/admin/places',
      event: '/admin/events',
      activity: '/admin/activities',
    };
    const route = routeMap[review.entityType];
    if (route) {
      this.router.navigate([route], { state: { openEditId: review.entityId } });
    }
  }

  protected openTouristPage(review: ReviewRow): void {
    if (!review.entitySlug) return;
    const base = `/${review.entityType}s/${review.entitySlug}`;
    window.open(base, '_blank');
  }

  protected starsArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }

  protected ratingClass(rating: number): string {
    return `rv-stars--r${rating}`;
  }

  protected entityTypeLabel(type: EntityType): string {
    const map: Record<EntityType, string> = {
      destination: this.ui.t('reviews.filter.entity.destination'),
      activity: this.ui.t('reviews.filter.entity.activity'),
      place: this.ui.t('reviews.filter.entity.place'),
      event: this.ui.t('reviews.filter.entity.event'),
    };
    return map[type];
  }

  protected truncateComment(comment: string | null, maxLen = 90): string {
    if (!comment) return '—';
    return comment.length > maxLen ? comment.slice(0, maxLen) + '…' : comment;
  }

  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('sr-Latn', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuId.set(null);
    this.isFilterOpen.set(false);
  }

  private loadReviews(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.reviewsService.getReviews(this.filters()).subscribe({
        next: (response) => {
          this.reviews.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.reviews.set([]);
          this.total.set(0);
          this.errorMessage.set(this.ui.t('reviews.error.load'));
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.subscription.add(
      this.reviewsService.getStats().subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.isStatsLoading.set(false);
        },
        error: () => this.isStatsLoading.set(false),
      }),
    );
  }

  private loadRegions(): void {
    this.subscription.add(
      this.http.get<LookupOption[]>('/api/regions').subscribe({
        next: (r) => this.regions.set(r),
        error: () => {},
      }),
    );
  }

  private loadCities(regionId: number): void {
    this.subscription.add(
      this.http.get<LookupOption[]>('/api/cities', { params: { regionId } }).subscribe({
        next: (c) => this.cities.set(c),
        error: () => {},
      }),
    );
  }

  private loadSubtypes(entityType: EntityType): void {
    const urlMap: Record<string, string> = {
      activity: '/api/activity-categories',
      event: '/api/event-types',
      place: '/api/place-types',
    };
    const url = urlMap[entityType];
    if (!url) return;
    this.subscription.add(
      this.http.get<LookupOption[]>(url).subscribe({
        next: (s) => this.subtypes.set(s),
        error: () => {},
      }),
    );
  }

  private patchFilter(patch: Partial<ReviewFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
  }
}
