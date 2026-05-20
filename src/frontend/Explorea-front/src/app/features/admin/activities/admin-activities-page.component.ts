import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { StatCardComponent } from '@shared/components';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
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
  ActivityImageItem,
  ActivityRow,
  ActivityStats,
  ActivityStatus,
  CategoryOption,
  CityOption,
  CreateActivityDto,
  DestinationOption,
  RegionOption,
} from './admin-activities.models';
import { AdminActivitiesService } from './admin-activities.service';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';

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
  selector: 'app-admin-activities-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
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
  @ViewChild('mapEl', { static: false }) private mapEl?: ElementRef<HTMLDivElement>;

  private readonly searchInput$ = new Subject<string>();
  private readonly destinationSearch$ = new Subject<string>();
  private readonly subscription = new Subscription();

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private lightStyle: unknown;
  private darkStyle: unknown;
  private themeObserver?: MutationObserver;

  protected readonly filters = signal<ActivityFilters>({
    search: '',
    categoryId: 'all',
    status: 'all',
    difficulty: 'all',
    minRating: 'all',
    regionId: 'all',
    extraFilters: {},
    page: 1,
    pageSize: 17,
  });

  protected readonly filterDefs = signal<FilterDefinition[]>([]);

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
  protected readonly modalImagePreviews = signal<{ file: File; url: string }[]>([]);
  protected readonly modalHeroIndex = signal<number>(0);
  protected readonly editExistingImages = signal<ActivityImageItem[]>([]);
  protected readonly editHeroImageId = signal<string | null>(null);
  protected readonly mapLatitude = signal<number | null>(null);
  protected readonly mapLongitude = signal<number | null>(null);
  protected readonly mapAddress = signal('');
  protected readonly isGeocoding = signal(false);
  protected readonly destinationSearchText = signal('');
  protected readonly destinationResults = signal<DestinationOption[]>([]);
  protected readonly destinationDropdownOpen = signal(false);
  protected readonly isDestinationSearching = signal(false);
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

  protected readonly isTouristOrganization = computed(
    () => this.authContext.context().role === 'tourist_organization',
  );

  protected readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return [
      f.categoryId !== 'all',
      f.status !== 'all',
      f.difficulty !== 'all',
      f.minRating !== 'all',
      !this.managedRegion() && f.regionId !== 'all',
      ...Object.keys(f.extraFilters).map(() => true),
    ].filter(Boolean).length;
  });

  protected readonly extraFilterEntries = computed(() =>
    Object.entries(this.filters().extraFilters).map(([key, value]) => ({ key, value }))
  );

  protected readonly statuses: Array<{ value: ActivityStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Svi statusi' },
    { value: 'active', label: 'Aktivno' },
    { value: 'inactive', label: 'Neaktivno' },
  ];

  protected readonly difficulties = signal<Array<{ value: ActivityDifficulty | 'all'; label: string }>>([
    { value: 'all', label: 'Sve težine' },
  ]);

  protected readonly managedRegion = signal<{ id: number; name: string } | null>(null);
  protected readonly hoverRating = signal<number | null>(null);

  constructor(
    private readonly activitiesService: AdminActivitiesService,
    private readonly lookupService: LookupService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    protected readonly authContext: AdminAuthContextService,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    this.hydrateFiltersFromQueryParams();
    const initialCatId = this.filters().categoryId;
    if (initialCatId !== 'all') this.loadFilterDefs(initialCatId);

    this.subscription.add(
      this.destinationSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => {
        if (!q.trim()) {
          this.destinationResults.set([]);
          this.destinationDropdownOpen.set(false);
          this.isDestinationSearching.set(false);
          return;
        }
        this.isDestinationSearching.set(true);
        this.subscription.add(
          this.activitiesService.searchDestinations(q).subscribe({
            next: (results) => {
              this.destinationResults.set(results);
              this.destinationDropdownOpen.set(results.length > 0);
              this.isDestinationSearching.set(false);
              this.cdr.detectChanges();
            },
            error: () => this.isDestinationSearching.set(false),
          }),
        );
      }),
    );

    this.subscription.add(
      this.searchInput$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        const q = value.trim();
        this.patchFilter({ search: value, ids: undefined, page: 1 });
        if (!q) {
          this.loadActivities();
          return;
        }
        this.loadActivitiesFuzzy(q);
      }),
    );

    this.loadStats();
    this.loadFilterOptions();
    this.loadRegions();
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.destroyMap();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected applyCategory(categoryId: number | 'all'): void {
    this.patchFilter({ categoryId, extraFilters: {}, page: 1 });
    if (categoryId !== 'all') {
      this.loadFilterDefs(categoryId);
    } else {
      this.filterDefs.set([]);
    }
    this.loadActivities();
  }

  protected applyExtraFilter(key: string, value: string): void {
    const current = this.filters().extraFilters;
    const updated = { ...current };
    if (updated[key] === value) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
    this.patchFilter({ extraFilters: updated, page: 1 });
    this.loadActivities();
  }

  protected filterDefLabel(key: string): string {
    return this.filterDefs().find(d => d.filterKey === key)?.filterLabel ?? key;
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
    const mr = this.managedRegion();
    this.filters.update((f) => ({
      search: '',
      ids: undefined,
      categoryId: 'all',
      status: 'all',
      difficulty: 'all',
      minRating: 'all',
      regionId: mr ? mr.id : 'all',
      extraFilters: {},
      page: 1,
      pageSize: f.pageSize,
    }));
    this.filterDefs.set([]);
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
    this.destroyMap();
    this.isEditMode.set(false);
    this.editingActivityId.set(null);
    this.modalInclusions.set([]);
    this.modalImagePreviews().forEach(p => URL.revokeObjectURL(p.url));
    this.modalImagePreviews.set([]);
    this.modalHeroIndex.set(0);
    this.editExistingImages.set([]);
    this.editHeroImageId.set(null);
    this.mapLatitude.set(null);
    this.mapLongitude.set(null);
    this.mapAddress.set('');
    this.destinationSearchText.set('');
    this.destinationResults.set([]);
    this.destinationDropdownOpen.set(false);
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
      latitude: undefined,
      longitude: undefined,
    });
    this.loadModalCities();
    this.isCreateModalOpen.set(true);
    setTimeout(() => this.initMap(null, null), 50);
  }

  protected openEditModal(): void {
    const detail = this.selectedActivityDetail();
    if (!detail) return;

    this.isEditMode.set(true);
    this.editingActivityId.set(detail.id);
    this.modalInclusions.set([...detail.inclusions]);
    this.modalImagePreviews().forEach(p => URL.revokeObjectURL(p.url));
    this.modalImagePreviews.set([]);
    this.modalHeroIndex.set(0);
    this.editExistingImages.set([...detail.images]);
    this.editHeroImageId.set(detail.images[0]?.id ?? null);
    this.mapLatitude.set(detail.latitude ?? null);
    this.mapLongitude.set(detail.longitude ?? null);
    this.mapAddress.set('');
    this.destinationResults.set([]);
    this.destinationDropdownOpen.set(false);
    this.newInclusionText.set('');

    if (detail.destinationId) {
      this.subscription.add(
        this.activitiesService.getDestination(detail.destinationId).subscribe({
          next: (d) => this.destinationSearchText.set(d.name),
        }),
      );
    } else {
      this.destinationSearchText.set('');
    }
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
    setTimeout(() => this.initMap(detail.latitude ?? null, detail.longitude ?? null), 50);
  }

  protected closeCreateModal(): void {
    this.destroyMap();
    this.modalImagePreviews().forEach(p => URL.revokeObjectURL(p.url));
    this.modalImagePreviews.set([]);
    this.modalHeroIndex.set(0);
    this.editExistingImages.set([]);
    this.editHeroImageId.set(null);
    this.mapLatitude.set(null);
    this.mapLongitude.set(null);
    this.mapAddress.set('');
    this.destinationSearchText.set('');
    this.destinationResults.set([]);
    this.destinationDropdownOpen.set(false);
    this.isCreateModalOpen.set(false);
    this.isSubmitting.set(false);
    this.isEditMode.set(false);
    this.editingActivityId.set(null);
    this.errorMessage.set('');
  }

  protected updateCreateField<K extends keyof CreateActivityDto>(key: K, value: CreateActivityDto[K]): void {
    this.createForm.update((f) => ({ ...f, [key]: value }));
  }

  protected updateDestinationSearch(value: string): void {
    this.destinationSearchText.set(value);
    this.createForm.update((f) => ({ ...f, destinationId: undefined }));
    this.destinationSearch$.next(value);
  }

  protected selectDestination(dest: DestinationOption): void {
    this.destinationSearchText.set(dest.name);
    this.destinationDropdownOpen.set(false);
    this.destinationResults.set([]);
    this.createForm.update((f) => ({ ...f, destinationId: dest.id }));
    this.subscription.add(
      this.activitiesService.getDestination(dest.id).subscribe({
        next: (d) => {
          if (d.latitude != null && d.longitude != null) {
            this.setMapCoords(d.latitude, d.longitude);
            this.cdr.detectChanges();
          }
        },
      }),
    );
  }

  protected clearDestination(): void {
    this.destinationSearchText.set('');
    this.destinationDropdownOpen.set(false);
    this.destinationResults.set([]);
    this.createForm.update((f) => ({ ...f, destinationId: undefined }));
  }

  protected closeDestinationDropdownDelayed(): void {
    setTimeout(() => this.destinationDropdownOpen.set(false), 150);
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
    const previews = files.map(file => ({ file, url: URL.createObjectURL(file) }));
    this.modalImagePreviews.update(existing => [...existing, ...previews]);
    input.value = '';
  }

  protected removeImageFile(index: number): void {
    const previews = this.modalImagePreviews();
    URL.revokeObjectURL(previews[index].url);
    this.modalImagePreviews.update(list => list.filter((_, i) => i !== index));
    const hero = this.modalHeroIndex();
    if (hero === index) this.modalHeroIndex.set(0);
    else if (hero > index) this.modalHeroIndex.update(h => h - 1);
  }

  protected setModalHero(index: number): void {
    this.modalHeroIndex.set(index);
  }

  protected deleteExistingImage(imageId: string): void {
    const activityId = this.editingActivityId();
    if (!activityId) return;
    this.subscription.add(
      this.activitiesService.deleteImage(activityId, imageId).subscribe({
        next: () => {
          this.editExistingImages.update(list => list.filter(img => img.id !== imageId));
          if (this.editHeroImageId() === imageId) {
            this.editHeroImageId.set(this.editExistingImages()[0]?.id ?? null);
          }
        },
        error: () => {
          this.errorMessage.set('Greška pri brisanju slike.');
        },
      }),
    );
  }

  protected setExistingHero(imageId: string): void {
    const activityId = this.editingActivityId();
    if (!activityId || this.editHeroImageId() === imageId) return;
    this.editHeroImageId.set(imageId);
    this.subscription.add(
      this.activitiesService.setHeroImage(activityId, imageId).subscribe({
        next: () => {
          this.editExistingImages.update(list => {
            const hero = list.find(img => img.id === imageId)!;
            const rest = list.filter(img => img.id !== imageId);
            return [hero, ...rest];
          });
        },
        error: () => {
          this.errorMessage.set('Greška pri postavljanju hero slike.');
        },
      }),
    );
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
    const lat = this.mapLatitude();
    const lng = this.mapLongitude();
    const dto: CreateActivityDto = {
      ...form,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
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
    return this.difficulties().find((d) => d.value === value)?.label ?? value;
  }

  protected selectedRatingLabel(): string {
    const value = this.filters().minRating;
    if (value === 'all') return '';
    return `${value}+ ★`;
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

  protected ratingNumeric(): number {
    const v = this.filters().minRating;
    return v === 'all' ? 0 : v;
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

    const extraFilters: Record<string, string> = {};
    for (const raw of qp.getAll('extraFilters')) {
      const idx = raw.indexOf(':');
      if (idx > 0) extraFilters[raw.slice(0, idx)] = raw.slice(idx + 1);
    }

    this.filters.set({
      search: qp.get('search')?.trim() ?? '',
      categoryId: this.parsePositiveInt(qp.get('categoryId'), 0) || 'all',
      status: this.parseStatus(qp.get('status')),
      difficulty: this.parseDifficulty(qp.get('difficulty')),
      minRating: this.parseMinRating(qp.get('minRating')),
      regionId: this.parsePositiveInt(qp.get('regionId'), 0) || 'all',
      extraFilters,
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

  private buildQueryParams(): Record<string, unknown> {
    const f = this.filters();
    const qp: Record<string, unknown> = {};

    if (f.search.trim())        qp['search']     = f.search.trim();
    if (f.categoryId !== 'all') qp['categoryId'] = f.categoryId;
    if (f.status !== 'all')     qp['status']     = f.status;
    if (f.difficulty !== 'all') qp['difficulty'] = f.difficulty;
    if (f.minRating !== 'all')  qp['minRating']  = f.minRating;
    if (f.regionId !== 'all')   qp['regionId']   = f.regionId;
    const efEntries = Object.entries(f.extraFilters);
    if (efEntries.length)       qp['extraFilters'] = efEntries.map(([k, v]) => `${k}:${v}`);
    if (f.page > 1)             qp['page']       = f.page;
    if (f.pageSize !== 17)      qp['pageSize']   = f.pageSize;

    return qp;
  }

  private parseStatus(value: string | null): ActivityStatus | 'all' {
    return this.statuses.some((s) => s.value === value) ? (value as ActivityStatus | 'all') : 'all';
  }

  private parseDifficulty(value: string | null): ActivityDifficulty | 'all' {
    const known: ActivityDifficulty[] = ['easy', 'medium', 'hard'];
    return known.includes(value as ActivityDifficulty) ? (value as ActivityDifficulty) : 'all';
  }

  private parseMinRating(value: string | null): number | 'all' {
    if (!value || value === 'all') return 'all';
    const n = Number(value);
    return n >= 1 && n <= 5 ? n : 'all';
  }

  private parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private loadFilterDefs(categoryId: number): void {
    this.subscription.add(
      this.lookupService.getFilterDefinitions('activity', categoryId).subscribe({
        next: (defs) => this.filterDefs.set(defs),
        error: () => this.filterDefs.set([]),
      }),
    );
  }

  private loadActivitiesFuzzy(query: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const allFilters = { ...this.filters(), search: '', ids: undefined, page: 1, pageSize: 500 };

    this.subscription.add(
      this.activitiesService.getActivities(allFilters).subscribe({
        next: (response) => {
          const q = query.toLowerCase();
          const matched = response.items.filter(a =>
            this.fuzzyMatch(a.name.toLowerCase(), q) ||
            (a.city && this.fuzzyMatch(a.city.toLowerCase(), q)) ||
            (a.region && this.fuzzyMatch(a.region.toLowerCase(), q)) ||
            (a.category && this.fuzzyMatch(a.category.toLowerCase(), q)),
          );
          this.activities.set(matched);
          this.total.set(matched.length);
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

  private fuzzyMatch(text: string, query: string): boolean {
    if (text.includes(query)) return true;
    if (query.length < 3) return false;

    // transposition tolerance: swap each adjacent pair and check
    for (let i = 0; i < query.length - 1; i++) {
      const swapped =
        query.slice(0, i) + query[i + 1] + query[i] + query.slice(i + 2);
      if (text.includes(swapped)) return true;
    }

    // single insertion tolerance: check all substrings of length query.length-1
    if (query.length >= 4) {
      for (let i = 0; i < query.length; i++) {
        const shortened = query.slice(0, i) + query.slice(i + 1);
        if (text.includes(shortened)) return true;
      }
    }

    return false;
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

  private readonly difficultyLabelMap: Record<string, string> = {
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
  };

  private loadFilterOptions(): void {
    this.subscription.add(
      this.activitiesService.getFilterOptions().subscribe({
        next: (opts) => {
          this.categories.set(opts.categories);

          this.difficulties.set([
            { value: 'all', label: 'Sve težine' },
            ...opts.difficulties.map(d => ({
              value: d as ActivityDifficulty,
              label: this.difficultyLabelMap[d] ?? d,
            })),
          ]);

          const mr = opts.managedRegion ?? null;
          this.managedRegion.set(mr);
          if (mr) {
            this.filters.update(f => ({ ...f, regionId: mr.id }));
            this.syncFiltersToQueryParams();
          }
        },
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

  protected geocode(): void {
    const address = this.mapAddress().trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.errorMessage.set('');
    this.subscription.add(
      this.http
        .get<{ lat: string; lon: string }[]>(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
          { headers: { 'Accept-Language': 'sr,en' } },
        )
        .subscribe({
          next: (results) => {
            this.isGeocoding.set(false);
            if (!results.length) {
              this.errorMessage.set('Adresa nije pronađena.');
              this.cdr.detectChanges();
              return;
            }
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            this.setMapCoords(lat, lng);
            this.cdr.detectChanges();
          },
          error: () => {
            this.isGeocoding.set(false);
            this.errorMessage.set('Greška pri pretrazi adrese.');
            this.cdr.detectChanges();
          },
        }),
    );
  }

  private async initMap(lat: number | null, lng: number | null): Promise<void> {
    if (!this.mapEl?.nativeElement) return;
    this.destroyMap();

    const base = await (await fetch(MAP_STYLE_URL)).json();
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle  = this.buildThemedStyle(base, DARK);

    const center: [number, number] = lat != null && lng != null ? [lng, lat] : [20.457, 44.017];
    const zoom = lat != null ? 12 : 6;

    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: (this.isDark ? this.darkStyle : this.lightStyle) as string,
      center,
      zoom,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    if (lat != null && lng != null) {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.mapLatitude.set(pos.lat);
        this.mapLongitude.set(pos.lng);
        this.cdr.detectChanges();
      });
    }

    this.map.on('click', (e) => {
      this.setMapCoords(e.lngLat.lat, e.lngLat.lng);
      this.cdr.detectChanges();
    });

    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style as string);
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private setMapCoords(lat: number, lng: number): void {
    this.mapLatitude.set(lat);
    this.mapLongitude.set(lng);

    if (!this.map) return;

    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true })
        .setLngLat([lng, lat])
        .addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.mapLatitude.set(pos.lat);
        this.mapLongitude.set(pos.lng);
        this.cdr.detectChanges();
      });
    }

    this.map.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });
  }

  private destroyMap(): void {
    this.themeObserver?.disconnect();
    this.themeObserver = undefined;
    this.marker?.remove();
    this.marker = null;
    this.map?.remove();
    this.map = null;
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private luminance(hex: string): number {
    if (!hex?.startsWith('#') || hex.length < 7) return 0;
    return parseInt(hex.slice(1, 3), 16) * 0.299
         + parseInt(hex.slice(3, 5), 16) * 0.587
         + parseInt(hex.slice(5, 7), 16) * 0.114;
  }

  private buildThemedStyle(base: unknown, p: typeof DARK): unknown {
    const themed = JSON.parse(JSON.stringify(base)) as { layers: { id?: string; type?: string; paint?: Record<string, unknown> }[] };
    themed.layers = themed.layers.map((layer) => {
      const id: string = layer.id ?? '';
      if (!layer.paint) return layer;
      delete layer.paint['fill-pattern'];
      switch (layer.type) {
        case 'background':
          layer.paint['background-color'] = p.land; break;
        case 'fill': {
          let c: string;
          if (/building/.test(id)) { layer.paint['fill-opacity'] = 0; break; }
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id)) { c = p.water; layer.paint['fill-outline-color'] = p.water; }
          else if (/forest|wood|scrub|grass|park|nature|garden|vegetation|landcover/.test(id)) { c = p.park; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.park; }
          else if (/landuse/.test(id)) { c = p.park; }
          else if (/sand|beach|desert|bare/.test(id)) { c = p.sand; }
          else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id)) { c = p.pedestrian; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.pedestrian; }
          else if (/bridge/.test(id)) { c = p.bridge; }
          else { const orig = typeof layer.paint['fill-color'] === 'string' ? layer.paint['fill-color'] : ''; c = this.luminance(orig) > 128 ? p.surface : p.land; }
          layer.paint['fill-color'] = c; break;
        }
        case 'line': {
          let c: string;
          if (/water|river|stream|canal/.test(id)) c = p.water;
          else if (/boundary|border/.test(id)) c = p.boundary;
          else if (/motorway|trunk|primary|major/.test(id)) c = p.road_major;
          else if (/path|track|footway|cycleway|step/.test(id)) c = p.road_path;
          else if (/bridge/.test(id)) c = p.bridge;
          else if (/casing|outline/.test(id)) c = p.land;
          else { const orig = typeof layer.paint['line-color'] === 'string' ? layer.paint['line-color'] : ''; c = this.luminance(orig) > 128 ? p.road_minor : p.land; }
          layer.paint['line-color'] = c; break;
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

  private loadModalCities(regionId?: number): void {
    this.subscription.add(
      this.activitiesService.getCities(regionId).subscribe({
        next: (cities) => this.modalCities.set(cities),
      }),
    );
  }

  private uploadPendingImages(activityId: string, activity: ActivityDetail): void {
    const previews = this.modalImagePreviews();
    if (!previews.length) {
      this.finalizeSubmit(activityId, activity);
      return;
    }

    const heroIdx = this.modalHeroIndex();
    const ordered = [
      previews[heroIdx],
      ...previews.filter((_, i) => i !== heroIdx),
    ].map(p => p.file);

    const uploadNext = (index: number) => {
      if (index >= ordered.length) {
        previews.forEach(p => URL.revokeObjectURL(p.url));
        this.finalizeSubmit(activityId, activity);
        return;
      }
      this.subscription.add(
        this.activitiesService.uploadImage(activityId, ordered[index]).subscribe({
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
