import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import {
  ConfirmDialogComponent,
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

@Component({
  selector: 'app-admin-reviews-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
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
  protected readonly isActionLoading = signal(false);
  protected readonly selectedReview = signal<ReviewRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.authContext.context().role === 'super_admin',
  );

  protected readonly isTouristOrg = computed(
    () => this.authContext.context().role === 'tourist_organization',
  );

  protected readonly isPlaceOwner = computed(
    () => this.authContext.context().role === 'place_owner',
  );

  protected readonly canHideApprove = computed(
    () => this.isSuperAdmin() || this.isTouristOrg(),
  );

  protected readonly showActionsMenu = computed(() => !this.isPlaceOwner());

  protected readonly showEntityTypeFilter = computed(() => !this.isPlaceOwner());

  protected readonly showVisibilityFilter = computed(() => !this.isPlaceOwner());

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.entityType !== 'all',
      f.minRating !== null,
      f.maxRating !== null,
      f.visibility !== 'all',
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
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadReviews();
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
    this.patchFilter({ entityType: value, page: 1 });
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
      minRating: null,
      maxRating: null,
      visibility: 'all',
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
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
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.selectedReview.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const review = this.selectedReview();
    if (!review) return;

    this.isDeleting.set(true);
    this.subscription.add(
      this.reviewsService.delete(review.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.selectedReview.set(null);
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

  protected starsArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }

  protected ratingClass(rating: number): string {
    if (rating >= 4) return 'high';
    if (rating === 3) return 'mid';
    return 'low';
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

  private patchFilter(patch: Partial<ReviewFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
  }
}
