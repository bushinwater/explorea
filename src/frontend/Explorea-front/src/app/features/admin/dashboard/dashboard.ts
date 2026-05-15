import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  OnDestroy, OnInit, WritableSignal, effect, signal, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
  CdkDragDrop, moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';

import { DashboardAuthService }      from '../core/services/dashboard-auth.service';
import { DashboardService }           from '../core/services/dashboard.service';
import { LayoutService }              from '../core/services/layout.service';
import { WidgetConfigService }        from '../core/services/widget-config.service';
import { AdminUiPreferencesService }  from '../core/services/admin-ui-preferences.service';
import { AdminRole, DashboardData, WidgetConfig, WidgetId } from '../core/models/admin.models';

import { StatCard }     from './widgets/stat-card/stat-card';
import { ActivityFeed } from './widgets/activity-feed/activity-feed';
import { QuickActions } from './widgets/quick-actions/quick-actions';
import { TrafficChart } from './widgets/traffic-chart/traffic-chart';
import { SystemStatus } from './widgets/system-status/system-status';
import { AiPanel }      from './widgets/ai-panel/ai-panel';

export interface DashRow { id: string; items: WidgetConfig[]; }

const COL_LABELS: Record<number, string> = { 1: '25%', 2: '50%', 3: '75%', 4: '100%' };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
    StatCard, ActivityFeed, QuickActions, TrafficChart, SystemStatus, AiPanel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  data           = signal<DashboardData | null>(null);
  widgets        = signal<WidgetConfig[]>([]);
  alertDismissed = signal(false);
  dragging   = signal(false);
  resizingId = signal<WidgetId | null>(null);
  resizeCols     = signal<1|2|3|4>(1);

  // SIGNAL — so Angular OnPush detects any mutation immediately
  visibleRows: WritableSignal<DashRow[]> = signal([]);
  newRowZone:  WidgetConfig[]            = [];
  hiddenWidgets: WidgetConfig[]          = [];

  private nextRowId = 0;

  private resizeState: {
    startX: number; startCols: 1|2|3|4; widgetId: WidgetId;
  } | null = null;
  private statsSubscription?: Subscription;
  private trafficSubscription?: Subscription;

  private readonly onMouseMove = this.handleResizeMove.bind(this);
  private readonly onMouseUp   = this.handleResizeEnd.bind(this);

  constructor(
    public  auth:         DashboardAuthService,
    private dashService:  DashboardService,
    public  layout:       LayoutService,
    private widgetConfig: WidgetConfigService,
    private cdr:          ChangeDetectorRef,
    public  ui:           AdminUiPreferencesService,
  ) {
    effect(() => {
      const role = this.auth.role();
      this.data.set(this.dashService.getData(role));
      this.loadOverviewStats(role);
      this.loadTraffic(role);
      this.widgets.set(this.widgetConfig.load(role));
      this.alertDismissed.set(false);
      this.layout.closeCustomize();
      // untracked: prevents widgets signal from being a reactive dependency of
      // this effect. Without it, syncFromRows() → widgets.set() would re-fire the
      // effect and call buildRowsFrom(), destroying the user's drag arrangement.
      untracked(() => this.buildArrays());
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.statsSubscription?.unsubscribe();
    this.trafficSubscription?.unsubscribe();
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup',   this.onMouseUp);
  }

  // ===== State builders =====

  buildArrays(): void {
    const role = this.auth.role();
    const all  = this.widgets();

    const visible = all
      .filter(w => w.visible && w.roles.includes(role))
      .sort((a, b) => a.order - b.order)
      .map(w => ({ ...w }));

    this.hiddenWidgets = all
      .filter(w => !w.visible || !w.roles.includes(role))
      .map(w => ({ ...w }));

    this.buildRowsFrom(visible);
  }

  private buildRowsFrom(widgets: WidgetConfig[]): void {
    // If widgets carry saved row info, restore the exact grouping
    if (widgets.some(w => w.row !== undefined)) {
      const rowMap = new Map<number, WidgetConfig[]>();
      for (const w of widgets) {
        const key = w.row ?? 0;
        if (!rowMap.has(key)) rowMap.set(key, []);
        rowMap.get(key)!.push(w);
      }
      const rows: DashRow[] = [...rowMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, items], i) => ({
          id: `row-${i}`,
          items: items.sort((a, b) => a.order - b.order),
        }));
      this.nextRowId  = rows.length;
      this.newRowZone = [];
      this.visibleRows.set(rows);
      return;
    }

    // Fallback (first run / after reset): pack by cols, max 4 per row
    const rows: DashRow[] = [];
    let items: WidgetConfig[] = [];
    let colsUsed = 0;
    let ri = 0;

    for (const w of widgets) {
      const c = w.cols ?? 4;
      if (colsUsed + c > 4 && items.length > 0) {
        rows.push({ id: `row-${ri++}`, items });
        items    = [];
        colsUsed = 0;
      }
      items.push(w);
      colsUsed += c;
    }
    if (items.length > 0) rows.push({ id: `row-${ri}`, items });

    this.nextRowId  = ri + 1;
    this.newRowZone = [];
    this.visibleRows.set(rows);
  }

  syncFromRows(): void {
    let ord = 0;
    const visible: WidgetConfig[] = [];
    this.visibleRows().forEach((row, rowIdx) => {
      row.items.forEach(w => {
        visible.push({ ...w, visible: true, order: ord++, row: rowIdx });
      });
    });
    const updated: WidgetConfig[] = [
      ...visible,
      ...this.hiddenWidgets.map((w, i) => ({ ...w, visible: false, order: i, row: undefined })),
    ];
    this.widgets.set(updated);
    this.widgetConfig.save(this.auth.role(), updated);
  }

  // IDs for panelList → connects the customizer palette to all dashboard rows
  get panelListIds(): string[] {
    return ['new-row-zone', ...this.visibleRows().map(r => r.id)];
  }

  // ===== Drawer helpers =====

  get drawerAllWidgets(): WidgetConfig[] {
    return this.widgets()
      .filter(w => w.roles.includes(this.auth.role()))
      .sort((a, b) => a.order - b.order);
  }

  isAvailable(w: WidgetConfig): boolean { return w.roles.includes(this.auth.role()); }

  get showAlert(): boolean {
    return !this.alertDismissed() && (this.data()?.pendingCount ?? 0) > 0;
  }

  colLabel(cols: 1|2|3|4): string { return COL_LABELS[cols] ?? ''; }

  private loadOverviewStats(role: AdminRole): void {
    this.statsSubscription?.unsubscribe();

    if (role !== 'super_admin' && role !== 'tourist_organization') {
      return;
    }

    this.statsSubscription = this.dashService.getOverviewStats().subscribe({
      next: (stats) => {
        this.data.update((current) => current ? { ...current, stats } : current);
        this.cdr.markForCheck();
      },
    });
  }

  private loadTraffic(role: AdminRole): void {
    this.trafficSubscription?.unsubscribe();

    if (role !== 'super_admin' && role !== 'tourist_organization') {
      return;
    }

    this.trafficSubscription = this.dashService.getTraffic(30).subscribe({
      next: (traffic) => {
        this.data.update((current) => current ? { ...current, traffic } : current);
        this.cdr.markForCheck();
      },
    });
  }

  // ===== Customizer =====

  openCustomize(): void { this.buildArrays(); this.layout.openCustomize(); }
  closeCustomize(): void { this.layout.closeCustomize(); }

  resetLayout(): void {
    const reset = this.widgetConfig.reset(this.auth.role());
    this.widgets.set(reset);
    this.buildArrays();
    this.syncFromRows();
  }

  toggleVisibility(id: WidgetId): void {
    const updated = this.widgets().map(w =>
      w.id === id ? { ...w, visible: !w.visible } : w,
    );
    this.widgets.set(updated);
    this.widgetConfig.save(this.auth.role(), updated);
    this.buildArrays();
  }

  // ===== Drag =====

  onDragStarted(): void { this.dragging.set(true); }

  onDragEnded(): void { this.dragging.set(false); }

  onDrop(event: CdkDragDrop<WidgetConfig[]>): void {
    const fromId = event.previousContainer.id;
    const toId   = event.container.id;

    if (fromId === toId) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      // Rebuild signal from mutated array
      this.visibleRows.update(rows => rows.map(r => r.id === toId
        ? { ...r, items: [...r.items] } : r));

    } else if (toId === 'new-row-zone') {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, 0);
      const widget   = this.newRowZone.splice(0, 1)[0];
      widget.visible = true;
      this.visibleRows.update(rows => [
        ...rows.map(r => r.id === fromId ? { ...r, items: [...r.items] } : r),
        { id: `row-${this.nextRowId++}`, items: [widget] },
      ]);

    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      event.container.data[event.currentIndex].visible = toId !== 'panelList';
      // Rebuild both rows' signals
      this.visibleRows.update(rows =>
        rows.map(r => (r.id === fromId || r.id === toId)
          ? { ...r, items: [...r.items] } : r));
    }

    // Remove empty rows
    this.visibleRows.update(rows => rows.filter(r => r.items.length > 0));

    this.dragging.set(false);
    this.syncFromRows();
  }

  // ===== Resize =====

  startResize(event: MouseEvent, widget: WidgetConfig): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeState = { startX: event.clientX, startCols: widget.cols, widgetId: widget.id };
    this.resizingId.set(widget.id);
    this.resizeCols.set(widget.cols);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup',   this.onMouseUp);
  }

  private handleResizeMove(event: MouseEvent): void {
    if (!this.resizeState) return;
    const dx        = event.clientX - this.resizeState.startX;
    const deltaCols = Math.round(dx / 140);
    const newCols   = Math.max(1, Math.min(4, this.resizeState.startCols + deltaCols)) as 1|2|3|4;

    if (newCols === this.resizeCols()) return;

    this.resizeCols.set(newCols);

    // Replace the item object so Angular signal-based change detection triggers
    const id = this.resizeState.widgetId;
    this.visibleRows.update(rows =>
      rows.map(row => ({
        ...row,
        items: row.items.map(w => w.id === id ? { ...w, cols: newCols } : w),
      }))
    );

    // Keep widgets signal in sync for storage
    this.widgets.update(all =>
      all.map(w => w.id === id ? { ...w, cols: newCols } : w)
    );
  }

  private handleResizeEnd(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup',   this.onMouseUp);
    if (this.resizeState) this.widgetConfig.save(this.auth.role(), this.widgets());
    this.resizeState = null;
    this.resizingId.set(null);
  }
}
