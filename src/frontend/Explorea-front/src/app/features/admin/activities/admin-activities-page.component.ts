import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { StatCardComponent } from '@shared/components';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminAuthContextService } from '../core/services/admin-auth-context.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { FeedbackBannerComponent } from '../shared/components/feedback-banner/feedback-banner.component';
import { TableSkeletonComponent } from '../shared/components/table-skeleton/table-skeleton.component';
import {
  ActivityDetail,
  ActivityDifficulty,
  ActivityFilters,
  ActivityRow,
  ActivityStats,
  ActivityStatus,
  CategoryOption,
  CityOption,
  CreateActivityDto,
  RegionOption,
} from './admin-activities.models';
import { AdminActivitiesService } from './admin-activities.service';

@Component({
  selector: 'app-admin-activities-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatCardComponent,
    FeedbackBannerComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    TableSkeletonComponent,
  ],
  templateUrl: './admin-activities-page.component.html',
  styleUrl: './admin-activities-page.component.css',
})
export class AdminActivitiesPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly filters = signal<ActivityFilters>({
    search: '',
    categoryId: 'all',
    status: 'all',
    difficulty: 'all',
    minRating: 'all',
    regionId: 'all',
    page: 1,
    pageSize: 17,
  });

  protected readonly activities = signal<ActivityRow[]>([]);
  protected readonly stats = signal<ActivityStats | null>(null);
  protected readonly categories = signal<CategoryOption[]>([]);
  protected readonly regions = signal<RegionOption[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isStatsLoading = signal(false);
  protected readonly isFilterOpen = signal(false);
  protected readonly activeMenuId = signal<string | null>(null);
  protected readonly isDeleteDialogOpen = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly activityToDelete = signal<ActivityRow | null>(null);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly isDetailsPanelOpen = signal(false);
  protected readonly isDetailLoading = signal(false);
  protected readonly selectedActivity = signal<ActivityRow | null>(null);
  protected readonly selectedActivityDetail = signal<ActivityDetail | null>(null);
  protected readonly isDescriptionExpanded = signal(false);

  protected readonly isCreateModalOpen = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isEditMode = signal(false);
  protected readonly editingActivityId = signal<string | null>(null);
  protected readonly modalInclusions = signal<string[]>([]);
  protected readonly modalImageFiles = signal<File[]>([]);
  protected readonly modalCities = signal<CityOption[]>([]);
  protected readonly modalRegionId = signal<number | 'all'>('all');
  protected readonly newInclusionText = signal('');
  protected readonly createForm = signal<CreateActivityDto>({
    name: '',
    slug: '',
    categoryId: 0,
    description: '',
    price: undefined,
    durationMinutes: undefined,
    difficultyLevel: '',
    cityId: undefined,
    destinationId: undefined,
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.filters().pageSize)),
  );

  protected readonly isSuperAdmin = computed(
    () => this.authContext.context().role === 'super_admin',
  );

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.categoryId !== 'all',
      f.status !== 'all',
      f.difficulty !== 'all',
      f.minRating !== 'all',
      f.regionId !== 'all',
    ].filter(Boolean).length;
  });

  protected readonly statuses: Array<{ value: ActivityStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Svi statusi' },
    { value: 'active', label: 'Aktivno' },
    { value: 'pending', label: 'Na čekanju' },
    { value: 'inactive', label: 'Neaktivno' },
    { value: 'rejected', label: 'Odbijeno' },
  ];

  protected readonly difficulties: Array<{ value: ActivityDifficulty | 'all'; label: string }> = [
    { value: 'all', label: 'Sve težine' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ];

  protected readonly ratingOptions: Array<{ value: number | 'all'; label: string }> = [
    { value: 'all', label: 'Sve ocene' },
    { value: 3, label: 'Sve 3+' },
    { value: 4, label: 'Sve 4+' },
    { value: 4.5, label: 'Sve 4.5+' },
  ];

  constructor(
    private readonly activitiesService: AdminActivitiesService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.hydrateFiltersFromQueryParams();

    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.patchFilter({ search: value, page: 1 });
        this.loadActivities();
      }),
    );

    this.loadStats();
    this.loadCategories();
    this.loadRegions();
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyCategory(categoryId: number | 'all'): void {
    this.patchFilter({ categoryId, page: 1 });
    this.loadActivities();
  }

  protected applyStatus(value: ActivityStatus | 'all'): void {
    this.patchFilter({ status: value, page: 1 });
    this.loadActivities();
  }

  protected applyDifficulty(value: ActivityDifficulty | 'all'): void {
    this.patchFilter({ difficulty: value, page: 1 });
    this.loadActivities();
  }

  protected applyRegion(regionId: number | 'all'): void {
    this.patchFilter({ regionId, page: 1 });
    this.loadActivities();
  }

  protected applyMinRating(value: number | 'all'): void {
    this.patchFilter({ minRating: value, page: 1 });
    this.loadActivities();
  }

  protected resetFilters(): void {
    this.filters.update((f) => ({
      search: '',
      categoryId: 'all',
      status: 'all',
      difficulty: 'all',
      minRating: 'all',
      regionId: 'all',
      page: 1,
      pageSize: f.pageSize,
    }));
    this.currentPage.set(1);
    this.syncFiltersToQueryParams();
    this.loadActivities();
  }

  protected goToPage(page: number): void {
    const clamped = Math.min(Math.max(page, 1), this.totalPages());
    this.patchFilter({ page: clamped });
    this.currentPage.set(clamped);
    this.loadActivities();
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.update((current) => (current === id ? null : id));
  }

  protected openDeleteDialog(activity: ActivityRow): void {
    this.activeMenuId.set(null);
    this.activityToDelete.set(activity);
    this.isDeleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.isDeleting.set(false);
    this.activityToDelete.set(null);
    this.isDeleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const activity = this.activityToDelete();
    if (!activity) return;

    this.isDeleting.set(true);

    this.subscription.add(
      this.activitiesService.delete(activity.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.isDeleteDialogOpen.set(false);
          this.activityToDelete.set(null);
          this.successMessage.set(`„${activity.name}" je uspešno uklonjena.`);
          if (this.selectedActivity()?.id === activity.id) {
            this.closeDetailsPanel();
          }
          this.loadActivities();
        },
        error: () => {
          this.isDeleting.set(false);
          this.errorMessage.set('Greška pri brisanju aktivnosti.');
        },
      }),
    );
  }

  protected openDetailsPanel(activity: ActivityRow): void {
    this.activeMenuId.set(null);
    this.selectedActivity.set(activity);
    this.selectedActivityDetail.set(null);
    this.isDetailsPanelOpen.set(true);
    this.isDetailLoading.set(true);
    this.isDescriptionExpanded.set(false);

    this.subscription.add(
      this.activitiesService.getById(activity.id).subscribe({
        next: (detail) => {
          this.selectedActivityDetail.set(detail);
          this.isDetailLoading.set(false);
        },
        error: () => {
          this.isDetailLoading.set(false);
          this.errorMessage.set('Greška pri učitavanju detalja aktivnosti.');
        },
      }),
    );
  }

  protected closeDetailsPanel(): void {
    this.isDetailsPanelOpen.set(false);
    this.selectedActivity.set(null);
    this.selectedActivityDetail.set(null);
    this.isDescriptionExpanded.set(false);
  }

  protected openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingActivityId.set(null);
    this.modalInclusions.set([]);
    this.modalImageFiles.set([]);
    this.modalCities.set([]);
    this.modalRegionId.set('all');
    this.newInclusionText.set('');
    this.createForm.set({
      name: '',
      slug: '',
      categoryId: this.categories()[0]?.id ?? 0,
      description: '',
      price: undefined,
      durationMinutes: undefined,
      difficultyLevel: '',
      cityId: undefined,
      destinationId: undefined,
    });
    this.loadModalCities();
    this.isCreateModalOpen.set(true);
  }

  protected openEditModal(): void {
    const detail = this.selectedActivityDetail();
    if (!detail) return;

    this.isEditMode.set(true);
    this.editingActivityId.set(detail.id);
    this.modalInclusions.set([...detail.inclusions]);
    this.modalImageFiles.set([]);
    this.newInclusionText.set('');
    this.createForm.set({
      name: detail.name,
      slug: detail.slug,
      categoryId: detail.categoryId,
      description: detail.description ?? '',
      price: detail.price ?? undefined,
      durationMinutes: detail.durationMinutes ?? undefined,
      difficultyLevel: detail.difficultyLevel ?? '',
      cityId: detail.cityId ?? undefined,
      destinationId: detail.destinationId ?? undefined,
    });

    const regionId = detail.regionId ?? null;
    this.modalRegionId.set(regionId ?? 'all');
    this.loadModalCities(regionId ?? undefined);

    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.isSubmitting.set(false);
    this.isEditMode.set(false);
    this.editingActivityId.set(null);
  }

  protected updateCreateField<K extends keyof CreateActivityDto>(key: K, value: CreateActivityDto[K]): void {
    this.createForm.update((f) => ({ ...f, [key]: value }));
  }

  protected addInclusion(): void {
    const text = this.newInclusionText().trim();
    if (!text) return;
    this.modalInclusions.update((list) => [...list, text]);
    this.newInclusionText.set('');
  }

  protected removeInclusion(index: number): void {
    this.modalInclusions.update((list) => list.filter((_, i) => i !== index));
  }

  protected onImageFilesSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.modalImageFiles.update((existing) => [...existing, ...files]);
    input.value = '';
  }

  protected removeImageFile(index: number): void {
    this.modalImageFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected onModalRegionChange(value: string): void {
    const regionId = value === 'all' ? 'all' : +value;
    this.modalRegionId.set(regionId);
    this.updateCreateField('cityId', undefined);
    this.loadModalCities(regionId === 'all' ? undefined : regionId);
  }

  protected submitCreate(): void {
    const form = this.createForm();
    if (!form.name.trim() || !form.slug.trim() || !form.categoryId) return;

    this.isSubmitting.set(true);

    const inclusions = this.modalInclusions();
    const dto: CreateActivityDto = {
      ...form,
      inclusions: inclusions.length ? inclusions : undefined,
    };

    if (this.isEditMode()) {
      const id = this.editingActivityId()!;
      this.subscription.add(
        this.activitiesService.update(id, dto).subscribe({
          next: (updated) => this.uploadPendingImages(id, updated),
          error: () => {
            this.isSubmitting.set(false);
            this.errorMessage.set('Greška pri izmeni aktivnosti.');
          },
        }),
      );
    } else {
      this.subscription.add(
        this.activitiesService.create(dto).subscribe({
          next: (created) => this.uploadPendingImages(created.id, created),
          error: () => {
            this.isSubmitting.set(false);
            this.errorMessage.set('Greška pri dodavanju aktivnosti.');
          },
        }),
      );
    }
  }

  protected deactivateSelectedActivity(): void {
    const detail = this.selectedActivityDetail();
    if (!detail) return;

    this.subscription.add(
      this.activitiesService.update(detail.id, { isActive: false }).subscribe({
        next: (updated) => {
          this.selectedActivityDetail.set(updated);
          this.activities.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.successMessage.set(`„${updated.name}" je deaktivirana.`);
        },
        error: () => {
          this.errorMessage.set('Greška pri promeni statusa aktivnosti.');
        },
      }),
    );
  }

  protected activateSelectedActivity(): void {
    const detail = this.selectedActivityDetail();
    if (!detail) return;

    this.subscription.add(
      this.activitiesService.update(detail.id, { isActive: true }).subscribe({
        next: (updated) => {
          this.selectedActivityDetail.set(updated);
          this.activities.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.successMessage.set(`„${updated.name}" je aktivirana.`);
        },
        error: () => {
          this.errorMessage.set('Greška pri promeni statusa aktivnosti.');
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected formatBigNumber(n: number): string {
    return n.toLocaleString('en-US');
  }

  protected formatViews(views: number): string {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  }

  protected difficultyLabel(difficulty: string | null): string {
    if (!difficulty) return '';
    const map: Record<string, string> = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    };
    return map[difficulty.toLowerCase()] ?? difficulty;
  }

  protected statusLabel(isActive: boolean): string {
    return isActive ? 'Aktivno' : 'Neaktivno';
  }

  protected statusKey(isActive: boolean): string {
    return isActive ? 'active' : 'inactive';
  }

  protected categoryIcon(categoryName: string): string {
    const lower = categoryName.toLowerCase();
    if (lower.includes('pešač') || lower.includes('planinaren') || lower.includes('hiking')) return 'hiking';
    if (lower.includes('vod') || lower.includes('kajak') || lower.includes('water')) return 'kayaking';
    if (lower.includes('kultura') || lower.includes('culture')) return 'account_balance';
    if (lower.includes('gastro') || lower.includes('hrana')) return 'restaurant';
    if (lower.includes('avantura') || lower.includes('adventure')) return 'landscape';
    if (lower.includes('wellness') || lower.includes('spa')) return 'spa';
    return 'directions_run';
  }

  protected thumbColor(categoryName: string): string {
    const lower = categoryName.toLowerCase();
    if (lower.includes('pešač') || lower.includes('planinaren') || lower.includes('hiking')) return '#1f5c3a';
    if (lower.includes('vod') || lower.includes('kajak') || lower.includes('water')) return '#1e4d7b';
    if (lower.includes('kultura') || lower.includes('culture')) return '#7c5c2e';
    if (lower.includes('gastro') || lower.includes('hrana')) return '#8b3a2a';
    if (lower.includes('avantura') || lower.includes('adventure')) return '#4a3060';
    if (lower.includes('wellness') || lower.includes('spa')) return '#2d6b6b';
    return '#3a5a6b';
  }

  protected thumbInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  protected formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  protected formatDuration(minutes: number | null): string {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }

  protected formatPrice(price: number | null): string {
    return price === null ? 'Besplatno' : `${price.toLocaleString('sr-Latn-RS')} RSD`;
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

  protected selectedCategoryLabel(): string {
    const id = this.filters().categoryId;
    if (id === 'all') return '';
    return this.categories().find((c) => c.id === id)?.name ?? String(id);
  }

  protected selectedStatusLabel(): string {
    const value = this.filters().status;
    if (value === 'all') return '';
    return this.statuses.find((s) => s.value === value)?.label ?? value;
  }

  protected selectedDifficultyLabel(): string {
    const value = this.filters().difficulty;
    if (value === 'all') return '';
    return this.difficulties.find((d) => d.value === value)?.label ?? value;
  }

  protected selectedRatingLabel(): string {
    const value = this.filters().minRating;
    if (value === 'all') return '';
    return this.ratingOptions.find((r) => r.value === value)?.label ?? `${value}+`;
  }

  protected selectedRegionLabel(): string {
    const id = this.filters().regionId;
    if (id === 'all') return '';
    return this.regions().find((r) => r.id === id)?.name ?? String(id);
  }

  protected toggleDescription(): void {
    this.isDescriptionExpanded.update((current) => !current);
  }

  protected shouldShowDescriptionToggle(description: string): boolean {
    return description.length > 140;
  }

  protected visibleDescription(description: string): string {
    if (this.isDescriptionExpanded() || description.length <= 140) {
      return description;
    }
    return `${description.slice(0, 140).trimEnd()}...`;
  }

  protected starArray(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuId.set(null);
  }

  private patchFilter(patch: Partial<ActivityFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    if (patch.page !== undefined) this.currentPage.set(patch.page);
    this.syncFiltersToQueryParams();
  }

  private hydrateFiltersFromQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const page = this.parsePositiveInt(qp.get('page'), 1);
    const pageSize = this.parsePositiveInt(qp.get('pageSize'), this.filters().pageSize);

    this.filters.set({
      search: qp.get('search')?.trim() ?? '',
      categoryId: this.parsePositiveInt(qp.get('categoryId'), 0) || 'all',
      status: this.parseStatus(qp.get('status')),
      difficulty: this.parseDifficulty(qp.get('difficulty')),
      minRating: this.parseMinRating(qp.get('minRating')),
      regionId: this.parsePositiveInt(qp.get('regionId'), 0) || 'all',
      page,
      pageSize,
    });

    this.currentPage.set(page);
  }

  private syncFiltersToQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildQueryParams(),
      replaceUrl: true,
    });
  }

  private buildQueryParams(): Record<string, string | number> {
    const f = this.filters();
    const qp: Record<string, string | number> = {};

    if (f.search.trim())      qp['search']     = f.search.trim();
    if (f.categoryId !== 'all') qp['categoryId'] = f.categoryId;
    if (f.status !== 'all')   qp['status']     = f.status;
    if (f.difficulty !== 'all') qp['difficulty'] = f.difficulty;
    if (f.minRating !== 'all')  qp['minRating']  = f.minRating;
    if (f.regionId !== 'all')   qp['regionId']   = f.regionId;
    if (f.page > 1)           qp['page']       = f.page;
    if (f.pageSize !== 17)    qp['pageSize']   = f.pageSize;

    return qp;
  }

  private parseStatus(value: string | null): ActivityStatus | 'all' {
    return this.statuses.some((s) => s.value === value) ? (value as ActivityStatus | 'all') : 'all';
  }

  private parseDifficulty(value: string | null): ActivityDifficulty | 'all' {
    return this.difficulties.some((d) => d.value === value) ? (value as ActivityDifficulty | 'all') : 'all';
  }

  private parseMinRating(value: string | null): number | 'all' {
    if (!value || value === 'all') return 'all';
    const n = Number(value);
    return this.ratingOptions.some((r) => r.value === n) ? n : 'all';
  }

  private parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private loadActivities(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.subscription.add(
      this.activitiesService.getActivities(this.filters()).subscribe({
        next: (response) => {
          this.activities.set(response.items);
          this.total.set(response.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.activities.set([]);
          this.total.set(0);
          this.errorMessage.set('Greška pri učitavanju aktivnosti.');
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.subscription.add(
      this.activitiesService.getStats().subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.isStatsLoading.set(false);
        },
        error: () => this.isStatsLoading.set(false),
      }),
    );
  }

  private loadCategories(): void {
    this.subscription.add(
      this.activitiesService.getCategories().subscribe({
        next: (cats) => this.categories.set(cats),
      }),
    );
  }

  private loadRegions(): void {
    this.subscription.add(
      this.activitiesService.getRegions().subscribe({
        next: (regions) => this.regions.set(regions),
      }),
    );
  }

  private loadModalCities(regionId?: number): void {
    this.subscription.add(
      this.activitiesService.getCities(regionId).subscribe({
        next: (cities) => this.modalCities.set(cities),
      }),
    );
  }

  private uploadPendingImages(activityId: string, activity: ActivityDetail): void {
    const files = this.modalImageFiles();
    if (!files.length) {
      this.finalizeSubmit(activityId, activity);
      return;
    }

    const uploadNext = (index: number) => {
      if (index >= files.length) {
        this.finalizeSubmit(activityId, activity);
        return;
      }
      this.subscription.add(
        this.activitiesService.uploadImage(activityId, files[index]).subscribe({
          next: () => uploadNext(index + 1),
          error: () => uploadNext(index + 1),
        }),
      );
    };
    uploadNext(0);
  }

  private finalizeSubmit(activityId: string, activity: ActivityDetail): void {
    const isEdit = this.isEditMode();
    this.isSubmitting.set(false);
    this.isCreateModalOpen.set(false);
    this.isEditMode.set(false);
    this.editingActivityId.set(null);

    if (isEdit) {
      this.successMessage.set(`„${activity.name}" je uspešno izmenjena.`);
      if (this.isDetailsPanelOpen()) {
        this.subscription.add(
          this.activitiesService.getById(activityId).subscribe({
            next: (detail) => this.selectedActivityDetail.set(detail),
          }),
        );
      }
    } else {
      this.successMessage.set(`„${activity.name}" je uspešno dodata.`);
    }

    this.loadActivities();
    this.loadStats();
  }
}
