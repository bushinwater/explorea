import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart, registerables, TooltipItem } from 'chart.js';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { FeedbackBannerComponent, StatCardComponent } from '@shared/components';
import {
  DataSource, VizType, TimeFrame,
  SavedTemplate, ReportMetric, PerformanceInsight,
  MOCK_BASE, METRIC_FACTORS, TIME_FRAME_LABELS,
} from './admin-reports.models';

Chart.register(...registerables);

const TEMPLATES_KEY = 'admin-report-templates-v1';

@Component({
  selector: 'app-admin-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent, FeedbackBannerComponent, RouterLink],
  templateUrl: './admin-reports-page.component.html',
  styleUrl: './admin-reports-page.component.css',
})
export class AdminReportsPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  protected readonly dataSource      = signal<DataSource>('destinations');
  protected readonly selectedMetrics = signal<Set<string>>(new Set(['traffic', 'conversion', 'users']));
  protected readonly vizType         = signal<VizType>('line');
  protected readonly timeFrame       = signal<TimeFrame>('last30');
  protected readonly isTemplatesOpen = signal(true);
  protected readonly isSaveOpen      = signal(false);
  protected readonly templateName    = signal('');
  protected readonly successMessage  = signal('');
  protected readonly savedTemplates  = signal<SavedTemplate[]>(this.readTemplates());

  protected readonly performanceStats: PerformanceInsight[] = [
    { labelKey: 'reports.insights.traffic', value: '1.2M',    trend: '+12.4%', hintKey: 'reports.insights.traffic.hint', tone: 'success' },
    { labelKey: 'reports.insights.topDest', value: 'Kragujevac', trend: '+3.2%', hintKey: 'reports.insights.topDest.hint', tone: 'neutral' },
    { labelKey: 'reports.insights.score',   value: '4.8/5.0', trend: '-0.2%',  hintKey: 'reports.insights.score.hint',   tone: 'neutral' },
  ];

  protected readonly dataSources: Array<{ id: DataSource; labelKey: string }> = [
    { id: 'destinations', labelKey: 'reports.source.destinations' },
    { id: 'users',        labelKey: 'reports.source.users' },
    { id: 'reviews',      labelKey: 'reports.source.reviews' },
    { id: 'requests',     labelKey: 'reports.source.requests' },
  ];

  protected readonly metrics: ReportMetric[] = [
    { id: 'traffic',    labelKey: 'reports.metric.traffic',    color: '#d9b26f' },
    { id: 'conversion', labelKey: 'reports.metric.conversion', color: '#28694c' },
    { id: 'users',      labelKey: 'reports.metric.users',      color: '#60a5fa' },
    { id: 'growth',     labelKey: 'reports.metric.growth',     color: '#a78bfa' },
  ];

  protected readonly vizTypes: Array<{ id: VizType; icon: string; labelKey: string }> = [
    { id: 'bar',   icon: 'bar_chart',   labelKey: 'reports.viz.bar' },
    { id: 'line',  icon: 'show_chart',  labelKey: 'reports.viz.line' },
    { id: 'pie',   icon: 'pie_chart',   labelKey: 'reports.viz.pie' },
    { id: 'table', icon: 'table_chart', labelKey: 'reports.viz.table' },
  ];

  protected readonly timeFrames: Array<{ id: TimeFrame; labelKey: string }> = [
    { id: 'last30',       labelKey: 'reports.timeframe.last30' },
    { id: 'last3months',  labelKey: 'reports.timeframe.last3months' },
    { id: 'last6months',  labelKey: 'reports.timeframe.last6months' },
    { id: 'ytd',          labelKey: 'reports.timeframe.ytd' },
    { id: 'last12months', labelKey: 'reports.timeframe.last12months' },
  ];

  protected readonly activeMetrics = computed(() =>
    this.metrics.filter(m => this.selectedMetrics().has(m.id)),
  );

  protected readonly currentViewLabel = computed(() => {
    const src = this.dataSources.find(s => s.id === this.dataSource());
    return src ? this.ui.t(src.labelKey) : '';
  });

  protected readonly chartTitle = computed(() => {
    const vt = this.vizTypes.find(v => v.id === this.vizType());
    return this.ui.t('reports.builder.preview.title', { vizType: vt ? this.ui.t(vt.labelKey) : '' });
  });

  protected readonly chartSubtitle = computed(() => {
    const src = this.dataSources.find(s => s.id === this.dataSource());
    const tf  = this.timeFrames.find(t => t.id === this.timeFrame());
    return this.ui.t('reports.builder.preview.subtitle', {
      source:    src ? this.ui.t(src.labelKey) : '',
      timeframe: tf  ? this.ui.t(tf.labelKey)  : '',
    });
  });

  protected readonly tableData = computed(() => {
    const labels = TIME_FRAME_LABELS[this.timeFrame()];
    const base   = MOCK_BASE[this.dataSource()][this.timeFrame()];
    const active = this.activeMetrics();
    return labels.map((label, i) => ({
      label,
      values: active.map(m => Math.round(base[i] * METRIC_FACTORS[m.id])),
    }));
  });

  constructor(protected readonly ui: AdminUiPreferencesService) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.vizType() !== 'table') this.rebuildChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  protected selectDataSource(src: DataSource): void {
    this.dataSource.set(src);
    this.rebuildChart();
  }

  protected toggleMetric(id: string): void {
    this.selectedMetrics.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    this.rebuildChart();
  }

  protected selectVizType(vt: VizType): void {
    const prev = this.vizType();
    this.vizType.set(vt);
    if (vt === 'table') {
      this.chart?.destroy();
      this.chart = null;
    } else if (prev === 'table') {
      setTimeout(() => this.rebuildChart());
    } else {
      this.rebuildChart();
    }
  }

  protected selectTimeFrame(tf: TimeFrame): void {
    this.timeFrame.set(tf);
    this.rebuildChart();
  }

  protected toggleTemplates(): void {
    this.isTemplatesOpen.update(v => !v);
  }

  protected loadTemplate(tpl: SavedTemplate): void {
    this.dataSource.set(tpl.dataSource);
    this.selectedMetrics.set(new Set(tpl.metrics));
    this.timeFrame.set(tpl.timeFrame);
    const prev = this.vizType();
    this.vizType.set(tpl.vizType);
    if (tpl.vizType === 'table') {
      this.chart?.destroy();
      this.chart = null;
    } else if (prev === 'table') {
      setTimeout(() => this.rebuildChart());
    } else {
      this.rebuildChart();
    }
  }

  protected deleteTemplate(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.savedTemplates.update(ts => ts.filter(t => t.id !== id));
    this.writeTemplates();
  }

  protected openSave(): void {
    this.templateName.set('');
    this.isSaveOpen.set(true);
  }

  protected closeSave(): void {
    this.isSaveOpen.set(false);
  }

  protected confirmSave(): void {
    const name = this.templateName().trim();
    if (!name) return;
    const tpl: SavedTemplate = {
      id:         Date.now().toString(),
      name,
      dataSource: this.dataSource(),
      metrics:    [...this.selectedMetrics()],
      vizType:    this.vizType(),
      timeFrame:  this.timeFrame(),
    };
    this.savedTemplates.update(ts => [...ts, tpl]);
    this.writeTemplates();
    this.isSaveOpen.set(false);
    this.flash(this.ui.t('reports.templates.saved'));
  }

  protected exportPdf(): void { this.flash(this.ui.t('reports.export.pdf.done')); }
  protected exportCsv(): void { this.flash(this.ui.t('reports.export.csv.done')); }

  protected metricSummary(metricId: string): string {
    const base   = MOCK_BASE[this.dataSource()][this.timeFrame()];
    const factor = METRIC_FACTORS[metricId];
    return this.formatNum(Math.max(...base.map(v => v * factor)));
  }

  protected formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(n < 10 ? 1 : 0);
  }

  private rebuildChart(): void {
    if (!this.viewReady || !this.canvasRef?.nativeElement) return;
    if (this.vizType() === 'table') return;
    this.chart?.destroy();
    this.chart = null;
    this.buildChart();
  }

  private buildChart(): void {
    const canvas  = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx     = canvas.getContext('2d')!;
    const viz     = this.vizType();
    const base    = MOCK_BASE[this.dataSource()][this.timeFrame()];
    const active  = this.metrics.filter(m => this.selectedMetrics().has(m.id));

    if (active.length === 0) return;

    if (viz === 'pie') {
      this.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels:   active.map(m => this.ui.t(m.labelKey)),
          datasets: [{
            data:            active.map(m => Math.round(base.reduce((s, v) => s + v * METRIC_FACTORS[m.id], 0))),
            backgroundColor: active.map(m => m.color + 'bb'),
            borderColor:     active.map(m => m.color),
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true, position: 'bottom',
              labels: { color: '#8fa896', font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 16 },
            },
            tooltip: {
              backgroundColor: '#1e2b20', borderColor: '#2a3a2d', borderWidth: 1,
              titleColor: '#f0f4f1', bodyColor: '#8fa896', padding: 12, cornerRadius: 8,
            },
          },
        },
      });
      return;
    }

    const labels   = TIME_FRAME_LABELS[this.timeFrame()];
    const datasets = active.map(m => {
      const factor = METRIC_FACTORS[m.id];
      const data   = base.map(v => Math.round(v * factor));
      const grad   = ctx.createLinearGradient(0, 0, 0, 280);
      grad.addColorStop(0, m.color + '40');
      grad.addColorStop(1, m.color + '00');
      return {
        label:                this.ui.t(m.labelKey),
        data,
        borderColor:          m.color,
        backgroundColor:      viz === 'line' ? grad : m.color + '99',
        borderWidth:          viz === 'line' ? 2.5 : 1.5,
        pointRadius:          viz === 'line' ? 4 : 0,
        pointBackgroundColor: m.color,
        pointBorderColor:     '#0f1612',
        pointBorderWidth:     2,
        tension:              viz === 'line' ? 0.4 : 0,
        fill:                 viz === 'line',
      };
    });

    this.chart = new Chart(ctx, {
      type: viz as 'bar' | 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true, position: 'top', align: 'end',
            labels: {
              color: '#8fa896', font: { family: 'Inter', size: 12 },
              boxWidth: 12, boxHeight: 3, padding: 16,
              usePointStyle: true, pointStyle: 'line',
            },
          },
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
            ticks:  { color: '#5a7060', font: { family: 'Inter', size: 11 }, callback: (v: any) => this.formatNum(v) },
            border: { display: false },
          },
        },
      },
    });
  }

  private flash(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  private readTemplates(): SavedTemplate[] {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      return raw ? (JSON.parse(raw) as SavedTemplate[]) : this.defaultTemplates();
    } catch {
      return this.defaultTemplates();
    }
  }

  private defaultTemplates(): SavedTemplate[] {
    return [
      { id: '1', name: 'Q3 Quarterly Review',   dataSource: 'destinations', metrics: ['traffic', 'conversion'], vizType: 'line', timeFrame: 'last3months' },
      { id: '2', name: 'TO Monthly Comparison', dataSource: 'users',        metrics: ['users', 'growth'],       vizType: 'bar',  timeFrame: 'last30' },
      { id: '3', name: 'Inbound Traffic Peak',  dataSource: 'destinations', metrics: ['traffic'],               vizType: 'line', timeFrame: 'ytd' },
    ];
  }

  private writeTemplates(): void {
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(this.savedTemplates())); } catch { /* storage unavailable */ }
  }
}
