import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { Chart, registerables, TooltipItem } from 'chart.js';
import { forkJoin, map } from 'rxjs';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { FeedbackBannerComponent, StatCardComponent } from '@shared/components';
import {
  AggregatePoint, DEST_SORT_OPTIONS, DIMENSION_CONFIGS, DestTableSortBy,
  DestinationsTableItem, ENTITY_CONFIGS, EntityProfile, EntitySearchItem, EntityTableRow,
  FLAT_TABLE_COLS, FLAT_TABLE_ENTITIES, FLAT_TABLE_SORT_OPTIONS, FilterDefinition,
  FlatTableEntity, METRIC_COLORS, METRIC_CONFIGS, PIE_COLORS, ReportDimensionId,
  ReportEntity, ReportInsights, ReportMetricId, ReportQueueItem, ReportTemplateDto,
  SEARCHABLE_ENTITIES, SavedReportConfig, SubtypeOption, VIZ_BY_DIM, VIZ_ICONS,
  VIZ_LABELS, VizType,
} from './admin-reports.models';
import { AdminReportsService } from './admin-reports.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent, FeedbackBannerComponent],
  templateUrl: './admin-reports-page.component.html',
  styleUrl: './admin-reports-page.component.css',
})
export class AdminReportsPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  // ─── Aggregate builder ───────────────────────────────────────────────────

  readonly entity    = signal<ReportEntity>('destinations');
  readonly dimension = signal<ReportDimensionId>('region');
  readonly metric    = signal<ReportMetricId>('count');
  readonly vizType   = signal<VizType>('bar');
  readonly dateFrom  = signal<string>(this.daysBefore(365));
  readonly dateTo    = signal<string>(this.today());

  readonly loading        = signal(false);
  readonly error          = signal<string | null>(null);
  readonly chartData      = signal<AggregatePoint[] | null>(null);
  readonly chartStatus    = signal<string | null>(null);

  // ─── Entity search ───────────────────────────────────────────────────────
  readonly selectedEntityId    = signal<string | null>(null);
  readonly selectedEntityName  = signal<string | null>(null);
  readonly entitySearchQuery   = signal('');
  readonly entitySearchResults = signal<EntitySearchItem[]>([]);
  readonly entitySearchOpen    = signal(false);
  readonly entityProfile       = signal<EntityProfile | null>(null);
  readonly profileLoading      = signal(false);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly insights       = signal<ReportInsights | null>(null);
  readonly templates      = signal<ReportTemplateDto[]>([]);
  readonly isTemplatesOpen = signal(true);
  readonly isSaveOpen     = signal(false);
  readonly templateName   = signal('');
  readonly successMessage = signal('');

  // ─── Flat table ──────────────────────────────────────────────────────────

  readonly flatEntities         = signal<FlatTableEntity[]>(['destinations']);
  readonly flatEntity           = computed(() => this.flatEntities()[0] ?? 'destinations');
  readonly destSortBy           = signal<DestTableSortBy>('region');
  readonly flatSortBy           = signal<string>('name');

  // flat table destination scope
  readonly flatDestId           = signal<string | null>(null);
  readonly flatDestName         = signal<string | null>(null);
  readonly flatDestSearchQuery  = signal('');
  readonly flatDestSearchResults = signal<EntitySearchItem[]>([]);
  readonly flatDestSearchOpen   = signal(false);
  private flatDestSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly destTableData        = signal<DestinationsTableItem[] | null>(null);
  readonly flatTableData        = signal<EntityTableRow[] | null>(null);
  readonly flatTableSections    = signal<{ entity: FlatTableEntity; label: string; data: EntityTableRow[] }[]>([]);
  readonly destTableLoading     = signal(false);
  readonly destTableError       = signal<string | null>(null);
  readonly filterSubTypeOptions  = signal<string[]>([]);
  readonly filterRegionOptions   = signal<string[]>([]);
  readonly filterSubType         = signal<string | null>(null);
  readonly filterRegion          = signal<string | null>(null);
  readonly filterMinRating       = signal<string | null>(null);
  readonly filterDifficultyOpts  = signal<string[]>([]);
  readonly filterDifficulty      = signal<string | null>(null);
  readonly filterMinPrice        = signal<number | null>(null);
  readonly filterMaxPrice        = signal<number | null>(null);
  readonly subtypeOptionsWithId  = signal<SubtypeOption[]>([]);
  readonly filterDefs            = signal<FilterDefinition[]>([]);
  readonly filterDefsLoading     = signal(false);
  readonly extraFilters          = signal<Record<string, string>>({});
  readonly filterOptionsLoading  = signal(false);
  readonly tableStatus           = signal<string | null>(null);

  // ─── PDF Queue ───────────────────────────────────────────────────────────

  readonly reportQueue     = signal<ReportQueueItem[]>([]);
  readonly isQueueOpen     = signal(true);
  readonly queueItemTitle  = signal('');
  readonly isAddQueueOpen  = signal(false);
  readonly pendingQueueType = signal<'chart' | 'table' | 'dest-table' | 'entity-table' | null>(null);
  readonly pdfGenerating   = signal(false);

  // ─── Computed ────────────────────────────────────────────────────────────

  readonly entityConfig = computed(() =>
    ENTITY_CONFIGS.find(e => e.id === this.entity())!,
  );
  readonly availableDimensions = computed(() => {
    if (this.selectedEntityId()) return [DIMENSION_CONFIGS['time']];
    return this.entityConfig().dimensions.map(id => DIMENSION_CONFIGS[id]);
  });
  readonly availableMetrics = computed(() => {
    const metrics = this.entityConfig().metrics;
    if (this.selectedEntityId()) return metrics.filter(id => id !== 'count').map(id => METRIC_CONFIGS[id]);
    return metrics.map(id => METRIC_CONFIGS[id]);
  });
  readonly supportsEntitySearch = computed(() => SEARCHABLE_ENTITIES.includes(this.entity()));
  readonly dimensionConfig = computed(() =>
    DIMENSION_CONFIGS[this.dimension()],
  );
  readonly availableVizTypes = computed(() =>
    VIZ_BY_DIM[this.dimensionConfig().type],
  );
  readonly isTimeDimension = computed(() =>
    this.dimensionConfig().type === 'time',
  );
  readonly chartTitle = computed(() => {
    const e = ENTITY_CONFIGS.find(ec => ec.id === this.entity())!;
    const d = DIMENSION_CONFIGS[this.dimension()];
    const m = METRIC_CONFIGS[this.metric()];
    const eLabel = this.ui.t('reports.entity.' + e.id)  || e.label;
    const dLabel = this.ui.t('reports.dim.'    + d.id)  || d.label;
    const mLabel = this.ui.t('reports.metric.' + m.id)  || m.label;
    return `${mLabel} — ${eLabel} / ${dLabel}`;
  });
  readonly chartHint = computed((): string | null => {
    const key = `reports.hint.${this.entity()}.${this.dimension()}.${this.metric()}`;
    return this.ui.t(key) || null;
  });
  readonly profileChips = computed(() => {
    const p = this.entityProfile();
    if (!p) return [];
    const trend = p.viewsPrev30 > 0
      ? Math.round((p.viewsLast30 - p.viewsPrev30) / p.viewsPrev30 * 100)
      : p.viewsLast30 > 0 ? 100 : 0;
    const trendLabel = trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '0%';
    const chips = [
      { icon: 'visibility',  label: 'Ukupno pregleda', value: this.formatNum(p.totalViews) },
      { icon: 'star',        label: 'Prosecna ocena',  value: p.avgRating > 0 ? p.avgRating.toFixed(1) + ' ★' : '—' },
      { icon: 'rate_review', label: 'Recenzije',       value: this.formatNum(p.reviewCount) },
      { icon: 'trending_up', label: 'Trend (30 dana)', value: trendLabel },
    ];
    if (p.placeCount || p.activityCount || p.eventCount) {
      chips.splice(3, 0,
        { icon: 'store',        label: 'Objekti',     value: this.formatNum(p.placeCount)    },
        { icon: 'hiking',       label: 'Aktivnosti',  value: this.formatNum(p.activityCount) },
        { icon: 'celebration',  label: 'Dogadjaji',   value: this.formatNum(p.eventCount)    },
      );
    }
    return chips;
  });

  readonly insightCards = computed(() => {
    const ins = this.insights();
    return [
      {
        label: this.ui.t('reports.insights.card.top_region.label'),
        value: ins?.topRegion ?? '—',
        trend: '',
        hint:  this.ui.t('reports.insights.card.top_region.hint'),
        tone:  'neutral' as const,
      },
      {
        label: this.ui.t('reports.insights.card.new_users.label'),
        value: ins ? String(ins.newUsersThisMonth) : '—',
        trend: '',
        hint:  this.ui.t('reports.insights.card.new_users.hint'),
        tone:  'neutral' as const,
      },
      {
        label: this.ui.t('reports.insights.card.top_entity.label'),
        value: ins?.topEntityType ?? '—',
        trend: '',
        hint:  this.ui.t('reports.insights.card.top_entity.hint'),
        tone:  'neutral' as const,
      },
    ];
  });

  readonly flatCols = computed(() => FLAT_TABLE_COLS[this.flatEntity()]);

  readonly flatScopedEntities = computed(() =>
    this.flatDestId()
      ? FLAT_TABLE_ENTITIES.filter(e => e.id !== 'destinations')
      : FLAT_TABLE_ENTITIES,
  );

  // Computed: destinations table grouped by region for display
  readonly destTableGrouped = computed(() => {
    const data = this.destTableData();
    if (!data) return null;
    if (this.destSortBy() !== 'region') return null; // only group visually when sorted by region
    const groups = new Map<string, DestinationsTableItem[]>();
    for (const item of data) {
      const key = item.region ?? 'Nepoznato';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([region, items]) => ({ region, items }));
  });

  readonly destSortOptions    = DEST_SORT_OPTIONS;
  readonly flatTableEntities  = FLAT_TABLE_ENTITIES;
  readonly flatTableSortOpts  = FLAT_TABLE_SORT_OPTIONS;
  readonly flatTableColDefs   = FLAT_TABLE_COLS;
  readonly vizIcons           = VIZ_ICONS;
  readonly vizLabels          = VIZ_LABELS;
  readonly entityConfigs      = ENTITY_CONFIGS;

  readonly subTypeLabel = computed(() => {
    const e = this.flatEntity();
    return e === 'activities' ? 'Kategorija' : 'Tip';
  });

  readonly scopeRegion = computed(() => this.insights()?.scopeRegion ?? null);

  constructor(
    private readonly svc: AdminReportsService,
    private readonly cdr: ChangeDetectorRef,
    public readonly ui: AdminUiPreferencesService,
  ) {
    this.svc.getInsights().subscribe({
      next: d => {
        this.insights.set(d);
        if (d.scopeRegion) this.filterRegion.set(d.scopeRegion);
        this.cdr.detectChanges();
      },
    });
    this.svc.getTemplates().subscribe({ next: d => { this.templates.set(d); this.cdr.detectChanges(); } });
    this.loadFilterOptions('destinations');
  }

  ngAfterViewInit(): void { this.viewReady = true; }
  ngOnDestroy(): void { this.chart?.destroy(); }

  // ─── Aggregate builder ───────────────────────────────────────────────────

  selectEntity(e: ReportEntity): void {
    this.entity.set(e);
    const cfg      = ENTITY_CONFIGS.find(ec => ec.id === e)!;
    const firstDim = cfg.dimensions[0];
    this.dimension.set(firstDim);
    this.metric.set(cfg.metrics[0]);
    const validViz = VIZ_BY_DIM[DIMENSION_CONFIGS[firstDim].type];
    if (!validViz.includes(this.vizType())) this.vizType.set(validViz[0]);
    this.clearEntitySelection();
    this.clearChart();
  }

  onEntitySearch(q: string): void {
    this.entitySearchQuery.set(q);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    if (q.length < 2) { this.entitySearchResults.set([]); this.entitySearchOpen.set(false); return; }
    this.searchTimeout = setTimeout(() => {
      this.svc.searchEntities(this.entity(), q).subscribe({
        next: results => {
          this.entitySearchResults.set(results);
          this.entitySearchOpen.set(results.length > 0);
          this.cdr.detectChanges();
        },
      });
    }, 280);
  }

  selectEntityFromSearch(id: string, name: string): void {
    this.selectedEntityId.set(id);
    this.selectedEntityName.set(name);
    this.entitySearchOpen.set(false);
    this.entitySearchQuery.set('');
    this.entitySearchResults.set([]);
    // force dimension to time and default metric to traffic
    this.dimension.set('time');
    const metrics = this.entityConfig().metrics.filter(m => m !== 'count');
    if (metrics.length) this.metric.set(metrics[0] as ReportMetricId);
    this.vizType.set('line');
    this.clearChart();
    this.entityProfile.set(null);
  }

  clearEntitySelection(): void {
    this.selectedEntityId.set(null);
    this.selectedEntityName.set(null);
    this.entitySearchQuery.set('');
    this.entitySearchResults.set([]);
    this.entitySearchOpen.set(false);
    this.entityProfile.set(null);
  }

  selectDimension(d: ReportDimensionId): void {
    this.dimension.set(d);
    const validViz = VIZ_BY_DIM[DIMENSION_CONFIGS[d].type];
    if (!validViz.includes(this.vizType())) this.vizType.set(validViz[0]);
    this.clearChart();
  }

  selectMetric(m: ReportMetricId): void {
    this.metric.set(m);
    this.clearChart();
  }

  selectVizType(vt: VizType): void {
    const prev = this.vizType();
    this.vizType.set(vt);
    if (vt === 'table') {
      this.destroyChart();
    } else if (prev === 'table' && this.chartData()) {
      setTimeout(() => this.buildChart());
    } else if (this.chartData()) {
      this.rebuildChart();
    }
  }

  generate(): void {
    this.loading.set(true);
    this.error.set(null);
    const dateFrom        = this.isTimeDimension() ? this.dateFrom() : null;
    const dateTo          = this.isTimeDimension() ? this.dateTo()   : null;
    const specificEntityId = this.selectedEntityId();

    if (specificEntityId) {
      this.profileLoading.set(true);
      this.svc.getEntityProfile(this.entity(), specificEntityId).subscribe({
        next:  p => { this.entityProfile.set(p); this.profileLoading.set(false); this.cdr.detectChanges(); },
        error: () => { this.profileLoading.set(false); },
      });
    }

    this.svc.getAggregate(this.entity(), this.dimension(), this.metric(), dateFrom, dateTo, specificEntityId, this.chartStatus())
      .subscribe({
        next: data => {
          this.loading.set(false);
          this.chartData.set(data);
          this.cdr.detectChanges();
          if (this.vizType() !== 'table') setTimeout(() => this.buildChart());
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Greška pri učitavanju podataka. Pokušajte ponovo.');
          this.cdr.detectChanges();
        },
      });
  }

  // ─── Templates ───────────────────────────────────────────────────────────

  toggleTemplates(): void { this.isTemplatesOpen.update(v => !v); }

  loadTemplate(tpl: ReportTemplateDto): void {
    try {
      const cfg = JSON.parse(tpl.parameters) as SavedReportConfig;
      this.entity.set(cfg.entity);
      this.dimension.set(cfg.dimension);
      this.metric.set(cfg.metric);
      this.vizType.set(cfg.vizType);
      if (cfg.dateFrom) this.dateFrom.set(cfg.dateFrom);
      if (cfg.dateTo)   this.dateTo.set(cfg.dateTo);
      this.clearChart();
    } catch { /* ignore */ }
  }

  deleteTemplate(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.svc.deleteTemplate(id).subscribe({
      next: () => { this.templates.update(ts => ts.filter(t => t.id !== id)); this.cdr.detectChanges(); },
    });
  }

  openSave(): void { this.templateName.set(''); this.isSaveOpen.set(true); }
  closeSave(): void { this.isSaveOpen.set(false); }

  confirmSave(): void {
    const name = this.templateName().trim();
    if (!name) return;
    const config: SavedReportConfig = {
      entity:    this.entity(),
      dimension: this.dimension(),
      metric:    this.metric(),
      vizType:   this.vizType(),
      dateFrom:  this.isTimeDimension() ? this.dateFrom() : null,
      dateTo:    this.isTimeDimension() ? this.dateTo()   : null,
    };
    this.svc.createTemplate({ name, parameters: JSON.stringify(config) }).subscribe({
      next: tpl => {
        this.templates.update(ts => [...ts, tpl]);
        this.isSaveOpen.set(false);
        this.flash('Šablon sačuvan.');
        this.cdr.detectChanges();
      },
    });
  }

  exportCsv(): void {
    const data = this.chartData();
    if (!data?.length) return;
    const lines = [`"${this.dimensionConfig().label}","${METRIC_CONFIGS[this.metric()].label}"`,
                   ...data.map(p => `"${p.label}",${p.value}`)];
    this.downloadCsv(lines.join('\n'), `report_${this.entity()}_${this.dimension()}.csv`);
  }

  // ─── Flat table ──────────────────────────────────────────────────────────

  selectFlatEntity(e: FlatTableEntity): void {
    if (e === 'destinations') this.clearFlatDest();
    const prev = this.flatEntity();
    this.flatEntities.set([e]);
    this.clearFlatResults();
    if (prev !== e) this.reloadFiltersFor(e);
  }

  toggleFlatEntity(e: FlatTableEntity): void {
    const current = this.flatEntities();
    const prevPrimary = current[0];

    let next: FlatTableEntity[];
    if (e === 'destinations') {
      if (current.length === 1 && current[0] === 'destinations') return;
      this.clearFlatDest();
      next = ['destinations'];
    } else {
      const withoutDest = current.filter(x => x !== 'destinations');
      if (withoutDest.includes(e)) {
        const remaining = withoutDest.filter(x => x !== e);
        next = remaining.length ? remaining : ['destinations'];
        if (next[0] === 'destinations') this.clearFlatDest();
      } else {
        next = [...withoutDest, e];
      }
    }

    this.flatEntities.set(next);
    this.clearFlatResults();
    if (prevPrimary !== next[0]) this.reloadFiltersFor(next[0]);
  }

  private clearFlatResults(): void {
    this.destTableData.set(null);
    this.flatTableData.set(null);
    this.flatTableSections.set([]);
    this.destTableError.set(null);
  }

  private reloadFiltersFor(e: FlatTableEntity): void {
    this.filterSubType.set(null);
    this.filterRegion.set(this.scopeRegion());
    this.filterMinRating.set(null);
    this.filterDifficulty.set(null);
    this.filterMinPrice.set(null);
    this.filterMaxPrice.set(null);
    this.filterDefs.set([]);
    this.extraFilters.set({});
    this.subtypeOptionsWithId.set([]);
    this.tableStatus.set(null);
    this.loadFilterOptions(e);
  }

  onFlatDestSearch(q: string): void {
    this.flatDestSearchQuery.set(q);
    if (this.flatDestSearchTimeout) clearTimeout(this.flatDestSearchTimeout);
    if (q.length < 2) { this.flatDestSearchResults.set([]); this.flatDestSearchOpen.set(false); return; }
    this.flatDestSearchTimeout = setTimeout(() => {
      this.svc.searchEntities('destinations', q).subscribe({
        next: results => {
          this.flatDestSearchResults.set(results);
          this.flatDestSearchOpen.set(results.length > 0);
          this.cdr.detectChanges();
        },
      });
    }, 280);
  }

  selectFlatDestFromSearch(id: string, name: string): void {
    this.flatDestId.set(id);
    this.flatDestName.set(name);
    this.flatDestSearchOpen.set(false);
    this.flatDestSearchQuery.set('');
    this.flatDestSearchResults.set([]);
    const prev = this.flatEntity();
    this.flatEntities.set(['activities', 'events', 'places']);
    this.clearFlatResults();
    if (prev === 'destinations') this.reloadFiltersFor('activities');
  }

  clearFlatDest(): void {
    this.flatDestId.set(null);
    this.flatDestName.set(null);
    this.flatDestSearchQuery.set('');
    this.flatDestSearchResults.set([]);
    this.flatDestSearchOpen.set(false);
  }

  clearSubType(): void {
    this.filterSubType.set(null);
    this.extraFilters.set({});
    this.filterDefs.set([]);
  }

  toggleFilter(field: string, value: string): void {
    switch (field) {
      case 'subType':
        this.filterSubType.update(v => v === value ? null : value);
        this.extraFilters.set({});
        this.filterDefs.set([]);
        const next = this.filterSubType();
        if (next && (this.flatEntity() === 'places' || this.flatEntity() === 'events')) {
          this.loadFilterDefs(next);
        }
        break;
      case 'region':     this.filterRegion.update(v => v === value ? null : value);    break;
      case 'minRating':  this.filterMinRating.update(v => v === value ? null : value); break;
      case 'difficulty': this.filterDifficulty.update(v => v === value ? null : value); break;
    }
  }

  toggleExtraFilter(key: string, value: string = 'true'): void {
    this.extraFilters.update(curr => {
      const copy = { ...curr };
      if (copy[key] === value) delete copy[key];
      else copy[key] = value;
      return copy;
    });
  }

  isExtraFilterActive(key: string, value: string = 'true'): boolean {
    return this.extraFilters()[key] === value;
  }

  private loadFilterDefs(subtypeName: string): void {
    const entity = this.flatEntity();
    const entityType = entity === 'places' ? 'place' : entity === 'events' ? 'event' : null;
    if (!entityType) return;
    const found = this.subtypeOptionsWithId().find(s => s.name === subtypeName);
    if (!found) return;
    this.filterDefsLoading.set(true);
    this.cdr.detectChanges();
    this.svc.getFilterDefinitions(entityType, found.id).subscribe({
      next: defs => {
        this.filterDefs.set(defs);
        this.filterDefsLoading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.filterDefs.set([]);
        this.filterDefsLoading.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  private loadFilterOptions(entity: FlatTableEntity): void {
    this.filterOptionsLoading.set(true);
    this.filterSubTypeOptions.set([]);
    this.filterRegionOptions.set([]);
    this.filterDifficultyOpts.set([]);

    const region$ = this.svc.getFilterOptions(entity, 'region');

    const applyScope = () => {
      const locked = this.scopeRegion();
      if (locked) this.filterRegion.set(locked);
    };

    if (entity === 'places' || entity === 'events') {
      forkJoin([this.svc.getSubtypeOptions(entity), region$]).subscribe({
        next: ([subtypes, regions]) => {
          this.subtypeOptionsWithId.set(subtypes);
          this.filterSubTypeOptions.set(subtypes.map(s => s.name));
          this.filterRegionOptions.set(regions);
          this.filterOptionsLoading.set(false);
          applyScope();
          this.cdr.detectChanges();
        },
        error: () => { this.filterOptionsLoading.set(false); this.cdr.detectChanges(); },
      });
    } else if (entity === 'activities') {
      forkJoin([
        this.svc.getFilterOptions(entity, 'subType'),
        region$,
        this.svc.getFilterOptions(entity, 'difficulty'),
      ]).subscribe({
        next: ([subTypes, regions, difficulties]) => {
          this.filterSubTypeOptions.set(subTypes);
          this.filterRegionOptions.set(regions);
          this.filterDifficultyOpts.set(difficulties);
          this.filterOptionsLoading.set(false);
          applyScope();
          this.cdr.detectChanges();
        },
        error: () => { this.filterOptionsLoading.set(false); this.cdr.detectChanges(); },
      });
    } else {
      forkJoin([this.svc.getFilterOptions(entity, 'subType'), region$]).subscribe({
        next: ([subTypes, regions]) => {
          this.filterSubTypeOptions.set(subTypes);
          this.filterRegionOptions.set(regions);
          this.filterOptionsLoading.set(false);
          applyScope();
          this.cdr.detectChanges();
        },
        error: () => { this.filterOptionsLoading.set(false); this.cdr.detectChanges(); },
      });
    }
  }

  generateFlatTable(): void {
    this.destTableLoading.set(true);
    this.destTableError.set(null);
    const entities = this.flatEntities();

    if (entities.length === 1 && entities[0] === 'destinations') {
      this.svc.getDestinationsTable(
        this.destSortBy(),
        this.filterSubType(), this.filterRegion(), this.filterMinRating(),
        this.tableStatus(),
      ).subscribe({
        next: data => { this.destTableLoading.set(false); this.destTableData.set(data); this.cdr.detectChanges(); },
        error: () => { this.destTableLoading.set(false); this.destTableError.set('Greška pri učitavanju.'); this.cdr.detectChanges(); },
      });
    } else {
      const nonDest = entities.filter(e => e !== 'destinations');
      const extraArr = Object.entries(this.extraFilters()).map(([k, v]) => `${k}:${v}`);
      const reqs = nonDest.map(entity =>
        this.svc.getEntityTable(
          entity, this.flatSortBy(),
          this.filterSubType(), this.filterRegion(), this.filterMinRating(),
          this.filterDifficulty(), this.filterMinPrice(), this.filterMaxPrice(),
          extraArr.length ? extraArr : null,
          this.flatDestId(),
          this.tableStatus(),
        ).pipe(map(data => ({
          entity,
          label: FLAT_TABLE_ENTITIES.find(x => x.id === entity)!.label,
          data,
        })))
      );
      forkJoin(reqs).subscribe({
        next: sections => {
          this.destTableLoading.set(false);
          this.flatTableSections.set(sections);
          this.flatTableData.set(sections[0]?.data ?? null);
          this.cdr.detectChanges();
        },
        error: () => { this.destTableLoading.set(false); this.destTableError.set('Greška pri učitavanju.'); this.cdr.detectChanges(); },
      });
    }
  }

  exportFlatTableCsv(): void {
    if (this.flatEntity() === 'destinations') {
      const data = this.destTableData();
      if (!data?.length) return;
      const cols = FLAT_TABLE_COLS['destinations'];
      const header = cols.map(c => `"${c.header}"`).join(',');
      const rows = data.map(d =>
        [`"${d.name}"`, `"${d.city ?? ''}"`, `"${d.region ?? ''}"`, `"${d.type ?? ''}"`, d.avgRating, d.popularity].join(','),
      );
      this.downloadCsv([header, ...rows].join('\n'), 'destinacije.csv');
      return;
    }

    const sections = this.flatTableSections();
    if (!sections.length) return;

    const lines: string[] = [];
    for (const section of sections) {
      const cols = FLAT_TABLE_COLS[section.entity];
      if (lines.length) lines.push('');
      lines.push(`"${section.label}"`);
      lines.push(cols.map(c => `"${c.header}"`).join(','));
      section.data.forEach(r =>
        lines.push(cols.map(c => {
          const v = (r as any)[c.key];
          return typeof v === 'string' ? `"${v}"` : String(v ?? '');
        }).join(','))
      );
    }
    const name = sections.length === 1 ? `${sections[0].entity}.csv` : 'entiteti.csv';
    this.downloadCsv(lines.join('\n'), name);
  }

  // kept for backward compat — now delegates to generateFlatTable
  generateDestTable(): void { this.generateFlatTable(); }
  exportDestTableCsv(): void { this.exportFlatTableCsv(); }

  // ─── PDF Queue ───────────────────────────────────────────────────────────

  toggleQueue(): void { this.isQueueOpen.update(v => !v); }

  promptAddToQueue(type: 'chart' | 'table' | 'dest-table' | 'entity-table'): void {
    this.pendingQueueType.set(type);
    const entity = this.flatEntity();
    const entityLabel = FLAT_TABLE_ENTITIES.find(e => e.id === entity)?.label ?? entity;
    const defaultTitle =
      type === 'dest-table'    ? 'Tabela destinacija'
      : type === 'entity-table' ? (this.flatTableSections().length > 1 ? `Tabele entiteta${this.flatDestName() ? ' — ' + this.flatDestName() : ''}` : `Tabela: ${entityLabel}`)
      : type === 'table'        ? `Tabela: ${this.chartTitle()}`
      :                           `Grafik: ${this.chartTitle()}`;
    this.queueItemTitle.set(defaultTitle);
    this.isAddQueueOpen.set(true);
  }

  cancelAddToQueue(): void {
    this.isAddQueueOpen.set(false);
    this.pendingQueueType.set(null);
  }

  confirmAddToQueue(): void {
    const type  = this.pendingQueueType();
    const title = this.queueItemTitle().trim() || 'Stavka izvestaja';
    if (!type) return;

    let item: ReportQueueItem | null = null;

    if (type === 'dest-table') {
      const data = this.destTableData();
      if (!data) return;
      item = { id: Date.now().toString(), title, qtype: 'dest-table', destData: data };
    } else if (type === 'entity-table') {
      const sections = this.flatTableSections();
      if (sections.length > 1) {
        // add each section as a separate queue item
        const base = title || 'Tabela entiteta';
        const items = sections.map((s, i) => ({
          id: (Date.now() + i).toString(),
          title: sections.length > 1 ? `${base} — ${s.label}` : base,
          qtype: 'entity-table' as const,
          entityData: s.data,
          entityCols: FLAT_TABLE_COLS[s.entity],
        }));
        this.reportQueue.update(q => [...q, ...items]);
        this.isAddQueueOpen.set(false);
        this.pendingQueueType.set(null);
        this.isQueueOpen.set(true);
        this.cdr.detectChanges();
        return;
      }
      const data = this.flatTableData();
      if (!data) return;
      const cols = FLAT_TABLE_COLS[this.flatEntity()];
      item = { id: Date.now().toString(), title, qtype: 'entity-table', entityData: data, entityCols: cols };
    } else if (type === 'table') {
      const data = this.chartData();
      if (!data) return;
      item = {
        id: Date.now().toString(), title, qtype: 'table', data,
        colLabel: this.dimensionConfig().label,
        colValue: METRIC_CONFIGS[this.metric()].label,
      };
    } else {
      // chart — capture at high resolution via offscreen chart instance
      const imageUrl = this.captureChartHighRes();
      if (!imageUrl) return;
      item = { id: Date.now().toString(), title, qtype: 'chart', imageUrl };
    }

    this.reportQueue.update(q => [...q, item!]);
    this.isAddQueueOpen.set(false);
    this.pendingQueueType.set(null);
    this.isQueueOpen.set(true);
    this.cdr.detectChanges();
  }

  removeFromQueue(id: string): void {
    this.reportQueue.update(q => q.filter(i => i.id !== id));
  }

  moveUp(id: string): void {
    this.reportQueue.update(q => {
      const idx = q.findIndex(i => i.id === id);
      if (idx <= 0) return q;
      const n = [...q];
      [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
      return n;
    });
  }

  moveDown(id: string): void {
    this.reportQueue.update(q => {
      const idx = q.findIndex(i => i.id === id);
      if (idx < 0 || idx >= q.length - 1) return q;
      const n = [...q];
      [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
      return n;
    });
  }

  async generateQueuePdf(): Promise<void> {
    const queue = this.reportQueue();
    if (!queue.length) return;

    this.pdfGenerating.set(true);
    this.cdr.detectChanges();

    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf      = new jsPDF('p', 'mm', 'a4');
      const pageW    = pdf.internal.pageSize.getWidth();
      const pageH    = pdf.internal.pageSize.getHeight();
      const margin   = 14;
      const contentW = pageW - 2 * margin;
      const dateStr  = new Date().toLocaleDateString(this.ui.language() === 'en' ? 'en-GB' : 'sr-Latn-RS', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });

      // ── TITLE PAGE ────────────────────────────────────────────────────────
      pdf.setFillColor(22, 65, 32);
      pdf.rect(0, 0, pageW, 62, 'F');
      pdf.setFillColor(35, 105, 50);
      pdf.rect(0, 0, 5, 62, 'F');

      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(205, 238, 215);
      pdf.text('Explorea', margin + 2, 30);

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(135, 190, 155);
      pdf.text('Automatski izvestaj', margin + 2, 43);

      pdf.setFontSize(8.5);
      pdf.setTextColor(95, 155, 120);
      pdf.text(dateStr, margin + 2, 56);

      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(45, 85, 55);
      pdf.text(`Broj sekcija: ${queue.length}`, margin, 80);

      pdf.setDrawColor(55, 130, 75);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 88, pageW - margin, 88);

      pdf.setFontSize(11.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(22, 55, 30);
      pdf.text('Sadrzaj', margin, 100);

      let tocY = 112;
      queue.forEach((item, idx) => {
        pdf.setFillColor(22, 65, 32);
        pdf.roundedRect(margin, tocY - 4.8, 7, 6.2, 1.2, 1.2, 'F');
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(190, 230, 205);
        pdf.text(String(idx + 1), margin + 3.5, tocY, { align: 'center' });

        pdf.setFontSize(9.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(38, 62, 45);
        const rawT = item.title.length > 50 ? item.title.slice(0, 47) + '...' : item.title;
        const t = this.sanitizePdfText(rawT);
        pdf.text(t, margin + 10, tocY);

        pdf.setTextColor(105, 148, 120);
        pdf.text(item.qtype === 'chart' ? 'Grafik' : 'Tabela', pageW - margin, tocY, { align: 'right' });

        tocY += 9.5;
      });

      // ── CONTENT PAGES ─────────────────────────────────────────────────────
      for (let i = 0; i < queue.length; i++) {
        pdf.addPage();
        const item = queue[i];

        pdf.setFillColor(22, 65, 32);
        pdf.rect(0, 0, pageW, 22, 'F');
        pdf.setFillColor(35, 105, 50);
        pdf.rect(0, 0, 5, 22, 'F');

        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(90, 155, 115);
        pdf.text('EXPLOREA', margin + 2, 8.5);

        pdf.setFontSize(10.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(210, 240, 220);
        const rawTt = item.title.length > 55 ? item.title.slice(0, 52) + '...' : item.title;
        const tt = this.sanitizePdfText(rawTt);
        pdf.text(tt, margin + 2, 17);

        pdf.setFillColor(38, 105, 55);
        pdf.roundedRect(pageW - margin - 26, 4, 26, 14, 2, 2, 'F');
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(180, 228, 198);
        pdf.text(`${i + 1} / ${queue.length}`, pageW - margin - 13, 13, { align: 'center' });

        const startY = 30;

        if (item.qtype === 'chart' && item.imageUrl) {
          const imgH = contentW * 0.58;
          pdf.setFillColor(247, 251, 248);
          pdf.setDrawColor(198, 222, 210);
          pdf.setLineWidth(0.35);
          pdf.roundedRect(margin, startY, contentW, imgH + 8, 3, 3, 'FD');
          pdf.addImage(item.imageUrl, 'JPEG', margin + 4, startY + 4, contentW - 8, imgH, undefined, 'FAST');

        } else if (item.qtype === 'table' && item.data) {
          this.drawPdfTable(pdf, pageW, pageH, margin, startY,
            [item.colLabel ?? 'Vrednost', item.colValue ?? 'Broj'],
            item.data.map(r => [r.label, String(r.value)]),
            [contentW * 0.60, contentW * 0.40],
          );

        } else if (item.qtype === 'dest-table' && item.destData) {
          this.drawPdfTable(pdf, pageW, pageH, margin, startY,
            ['Naziv', 'Grad', 'Regija', 'Tip', 'Ocena', 'Posete'],
            item.destData.map(d => [
              d.name, d.city ?? '', d.region ?? '', d.type ?? '',
              String(d.avgRating), String(d.popularity),
            ]),
            [contentW*0.26, contentW*0.14, contentW*0.16, contentW*0.16, contentW*0.13, contentW*0.15],
          );
        } else if (item.qtype === 'entity-table' && item.entityData && item.entityCols) {
          const cw = contentW / item.entityCols.length;
          this.drawPdfTable(pdf, pageW, pageH, margin, startY,
            item.entityCols.map(c => c.header),
            item.entityData.map(r => item.entityCols!.map(c => String((r as any)[c.key] ?? ''))),
            item.entityCols.map(() => cw),
          );
        }
      }

      // ── FOOTERS — stamp all pages at once ─────────────────────────────────
      const totalPages = (pdf as any).getNumberOfPages() as number;
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setDrawColor(195, 218, 205);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageH - 13, pageW - margin, pageH - 13);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 178, 162);
        pdf.text(`Explorea — Generisano: ${dateStr}`, margin, pageH - 8);
        pdf.text(`${p} / ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
      }

      const now     = new Date();
      const dd      = String(now.getDate()).padStart(2, '0');
      const mm      = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy    = String(now.getFullYear());
      const country = this.sanitizePdfText(this.insights()?.countryName ?? 'izvestaj')
        .toLowerCase().replace(/\s+/g, '_');
      pdf.save(`explorea_${country}_${dd}${mm}${yyyy}.pdf`);
    } finally {
      this.pdfGenerating.set(false);
      this.cdr.detectChanges();
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(n < 10 ? 1 : 0);
  }

  queueIcon(type: string): string {
    return type === 'chart' ? 'bar_chart' : type === 'table' ? 'table_chart' : 'list';
  }

  sectionIcon(entity: FlatTableEntity): string {
    const icons: Record<FlatTableEntity, string> = {
      destinations: 'place',
      activities:   'hiking',
      events:       'celebration',
      places:       'store',
    };
    return icons[entity];
  }

  private clearChart(): void {
    this.destroyChart();
    this.chartData.set(null);
    this.error.set(null);
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private rebuildChart(): void {
    this.destroyChart();
    if (this.viewReady) this.buildChart();
  }

  /**
   * Capture chart to a high-resolution PNG for crisp PDF export.
   * Creates a temporary 2400x1400 offscreen canvas with DPR=2 → ~4800x2800 buffer.
   */
  private captureChartHighRes(): string | null {
    const data = this.chartData();
    if (!data?.length) return null;
    const viz = this.vizType();
    if (viz === 'table') return null;

    const TARGET_W = 2400;
    const TARGET_H = 1400;

    const off = document.createElement('canvas');
    off.width  = TARGET_W;
    off.height = TARGET_H;
    off.style.width  = `${TARGET_W}px`;
    off.style.height = `${TARGET_H}px`;
    const ctx = off.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);

    const labels = data.map(p => p.label);
    const values = data.map(p => p.value);
    const color  = METRIC_COLORS[this.metric()];

    let tempChart: Chart | null = null;
    try {
      if (viz === 'pie') {
        const total = values.reduce((s, v) => s + v, 0);
        tempChart = new Chart(ctx, {
          type:    'pie',
          plugins: [ChartDataLabels],
          data: {
            labels,
            datasets: [{
              data:            values,
              backgroundColor: PIE_COLORS.map(c => c + 'cc'),
              borderColor:     PIE_COLORS,
              borderWidth:     4,
            }],
          },
          options: {
            responsive:          false,
            maintainAspectRatio: false,
            animation:           false,
            devicePixelRatio:    2,
            layout: { padding: { top: 80, bottom: 100, left: 64, right: 64 } },
            plugins: {
              legend: {
                display:  true,
                position: 'bottom',
                labels:   { color: '#1e293b', font: { family: 'Inter', size: 22 }, boxWidth: 20, padding: 20 },
              },
              tooltip: { enabled: false },
              datalabels: {
                anchor:    'end',
                align:     'end',
                offset:    10,
                clamp:     true,
                color:     '#334155',
                font:      { size: 20, weight: 'bold', family: 'Inter' },
                formatter: (value: number) => {
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${value.toFixed(1)}\n(${pct}%)`;
                },
              },
            },
          } as any,
        });
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, TARGET_H);
        grad.addColorStop(0, color + 'cc');
        grad.addColorStop(1, color + '11');
        tempChart = new Chart(ctx, {
          type: viz as 'bar' | 'line',
          data: {
            labels,
            datasets: [{
              label:                METRIC_CONFIGS[this.metric()].label,
              data:                 values,
              borderColor:          color,
              backgroundColor:      viz === 'line' ? grad : color + '99',
              borderWidth:          viz === 'line' ? 4 : 2,
              pointRadius:          viz === 'line' ? 7 : 0,
              pointBackgroundColor: color,
              pointBorderColor:     '#ffffff',
              pointBorderWidth:     3,
              tension:              viz === 'line' ? 0.4 : 0,
              fill:                 viz === 'line',
            }],
          },
          options: {
            responsive:          false,
            maintainAspectRatio: false,
            animation:           false,
            devicePixelRatio:    2,
            plugins: {
              legend:  { display: false },
              tooltip: { enabled: false },
            },
            scales: {
              x: {
                grid:   { color: 'rgba(100,116,139,0.2)' } as any,
                ticks:  { color: '#475569', font: { family: 'Inter', size: 22 } },
              },
              y: {
                grid:   { color: 'rgba(100,116,139,0.2)' } as any,
                ticks:  { color: '#475569', font: { family: 'Inter', size: 22 } },
              },
            },
          } as any,
        });
      }
      tempChart.draw();
      // JPEG doesn't support transparency — paint white BEHIND the chart so transparent
      // areas become white instead of the default black JPEG fill.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);
      ctx.globalCompositeOperation = 'source-over';
      const dataUrl = off.toDataURL('image/jpeg', 0.92);
      return dataUrl;
    } finally {
      try { tempChart?.destroy(); } catch { /* ignore */ }
    }
  }

  private buildChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const data = this.chartData();
    if (!data?.length) return;
    const viz = this.vizType();
    if (viz === 'table') return;

    this.destroyChart();
    const ctx    = canvas.getContext('2d')!;
    const labels = data.map(p => p.label);
    const values = data.map(p => p.value);
    const color  = METRIC_COLORS[this.metric()];

    if (viz === 'pie') {
      const total = values.reduce((s, v) => s + v, 0);
      this.chart = new Chart(ctx, {
        type:    'pie',
        plugins: [ChartDataLabels],
        data: {
          labels,
          datasets: [{
            data:            values,
            backgroundColor: PIE_COLORS.map(c => c + 'cc'),
            borderColor:     PIE_COLORS,
            borderWidth:     2,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          devicePixelRatio:    Math.max(3, window.devicePixelRatio || 1),
          layout: { padding: 32 },
          plugins: {
            legend: {
              display:  true,
              position: 'bottom',
              labels:   { color: '#8fa896', font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 16 },
            },
            tooltip: {
              backgroundColor: '#1e2b20', borderColor: '#2a3a2d', borderWidth: 1,
              titleColor: '#f0f4f1', bodyColor: '#8fa896', padding: 12, cornerRadius: 8,
            },
            datalabels: {
              anchor:    'end',
              align:     'end',
              offset:    6,
              clamp:     false,
              color:     '#c8d8c8',
              font:      { size: 10, weight: 'bold', family: 'Inter' },
              formatter: (value: number) => {
                const pct = total > 0 ? Math.round(value / total * 100) : 0;
                return pct >= 4 ? `${this.formatNum(value)}\n(${pct}%)` : '';
              },
            } as any,
          },
        },
      });
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');

    this.chart = new Chart(ctx, {
      type: viz as 'bar' | 'line',
      data: {
        labels,
        datasets: [{
          label:                METRIC_CONFIGS[this.metric()].label,
          data:                 values,
          borderColor:          color,
          backgroundColor:      viz === 'line' ? grad : color + '99',
          borderWidth:          viz === 'line' ? 2.5 : 1.5,
          pointRadius:          viz === 'line' ? 4 : 0,
          pointBackgroundColor: color,
          pointBorderColor:     '#0f1612',
          pointBorderWidth:     2,
          tension:              viz === 'line' ? 0.4 : 0,
          fill:                 viz === 'line',
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        devicePixelRatio:    Math.max(3, window.devicePixelRatio || 1),
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e2b20', borderColor: '#2a3a2d', borderWidth: 1,
            titleColor: '#f0f4f1', bodyColor: '#8fa896', padding: 12, cornerRadius: 8,
            callbacks: {
              label: (item: TooltipItem<'line'>) =>
                ` ${item.dataset.label}: ${this.formatNum(item.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid:   { color: 'rgba(42,58,45,0.5)', drawBorder: false } as any,
            ticks:  { color: '#5a7060', font: { family: 'Inter', size: 11 } },
            border: { display: false },
          },
          y: {
            grid:   { color: 'rgba(42,58,45,0.5)', drawBorder: false } as any,
            ticks:  { color: '#5a7060', font: { family: 'Inter', size: 11 }, callback: (v: any) => this.metric() !== 'avgRating' && !Number.isInteger(v) ? '' : this.formatNum(v) },
            border: { display: false },
          },
        },
      },
    });
  }

  private drawPdfTable(
    pdf: any, pageW: number, pageH: number,
    margin: number, startY: number,
    headers: string[], rows: string[][],
    colWidths: number[],
  ): void {
    const rowH    = 7.5;
    const headerH = 9.5;
    const tableW  = colWidths.reduce((a, b) => a + b, 0);
    let y         = startY;
    let sectionY  = startY;

    const paintHeader = (): void => {
      pdf.setFillColor(22, 65, 32);
      pdf.rect(margin, y, tableW, headerH, 'F');
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(205, 235, 215);
      let x = margin;
      headers.forEach((h, i) => {
        const txt = (pdf.splitTextToSize(this.sanitizePdfText(h), colWidths[i] - 4) as string[])[0] ?? this.sanitizePdfText(h);
        pdf.text(txt, x + 3, y + 6.5);
        x += colWidths[i];
      });
      pdf.setDrawColor(38, 95, 52);
      pdf.setLineWidth(0.2);
      let xd = margin;
      colWidths.slice(0, -1).forEach(w => { xd += w; pdf.line(xd, y, xd, y + headerH); });
      y += headerH;
    };

    const closeBorder = (): void => {
      pdf.setDrawColor(170, 205, 188);
      pdf.setLineWidth(0.45);
      pdf.rect(margin, sectionY, tableW, y - sectionY);
    };

    pdf.setDrawColor(170, 205, 188);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, margin + tableW, y);
    paintHeader();

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);

    rows.forEach((row, ri) => {
      if (y + rowH > pageH - 18) {
        closeBorder();
        pdf.addPage();
        sectionY = margin + 5;
        y = sectionY;
        pdf.setDrawColor(170, 205, 188);
        pdf.setLineWidth(0.4);
        pdf.line(margin, y, margin + tableW, y);
        paintHeader();
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
      }

      pdf.setFillColor(ri % 2 === 0 ? 244 : 255, ri % 2 === 0 ? 249 : 255, ri % 2 === 0 ? 247 : 255);
      pdf.rect(margin, y, tableW, rowH, 'F');

      pdf.setTextColor(32, 55, 40);
      let x = margin;
      row.forEach((cell, ci) => {
        const txt = (pdf.splitTextToSize(this.sanitizePdfText(String(cell)), colWidths[ci] - 5) as string[])[0] ?? '';
        pdf.text(txt, x + 3, y + 5.2);
        x += colWidths[ci];
      });

      pdf.setDrawColor(215, 230, 220);
      pdf.setLineWidth(0.18);
      pdf.line(margin, y + rowH, margin + tableW, y + rowH);

      pdf.setDrawColor(218, 232, 223);
      pdf.setLineWidth(0.15);
      let xd = margin;
      colWidths.slice(0, -1).forEach(w => { xd += w; pdf.line(xd, y, xd, y + rowH); });

      y += rowH;
    });

    closeBorder();
  }

  private sanitizePdfText(str: string): string {
    return (str ?? '')
      .replace(/Đ/g, 'Dj').replace(/đ/g, 'dj')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  private flash(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => { this.successMessage.set(''); this.cdr.detectChanges(); }, 3000);
  }

  private downloadCsv(content: string, filename: string): void {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  readonly todayStr = this.today();

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
    if (this.dateTo() && value > this.dateTo()) this.dateTo.set(value);
  }

  setDateTo(value: string): void {
    if (value < this.dateFrom()) this.dateFrom.set(value);
    this.dateTo.set(value);
  }

  private today(): string { return new Date().toISOString().slice(0, 10); }

  private daysBefore(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
}
