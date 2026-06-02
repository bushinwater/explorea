import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  OnDestroy, OnInit, WritableSignal, effect, signal, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  newRowZone:    WidgetConfig[]          = [];
  newRowZoneTop: WidgetConfig[]          = [];
  hiddenWidgets: WidgetConfig[]          = [];

  private nextRowId = 0;

  private resizeState: {
    startX: number; startCols: 1|2|3|4; widgetId: WidgetId; direction: 'left' | 'right';
  } | null = null;
  private statsSubscription?: Subscription;
  private trafficSubscription?: Subscription;
  private activitySubscription?: Subscription;
  private systemStatusSubscription?: Subscription;
  private aiInsightsSubscription?: Subscription;
  private pendingCountSubscription?: Subscription;
  private pendingEventCount = 0;
  private pendingPlaceCount = 0;

  private readonly onMouseMove = this.handleResizeMove.bind(this);
  private readonly onMouseUp   = this.handleResizeEnd.bind(this);

  constructor(
    public  auth:         DashboardAuthService,
    private dashService:  DashboardService,
    public  layout:       LayoutService,
    private widgetConfig: WidgetConfigService,
    private cdr:          ChangeDetectorRef,
    public  ui:           AdminUiPreferencesService,
    private router:       Router,
  ) {
    effect(() => {
      const role = this.auth.role();
      this.data.set({
        pendingCount: 0,
        stats: [],
        activity: [],
        quickActions: this.dashService.getQuickActions(role),
      });
      this.loadPendingCount();
      this.loadOverviewStats(role);
      this.loadTraffic(role);
      this.loadRecentActivity(role);
      this.loadSystemStatus(role);
      this.loadAiInsights(role);
      this.widgets.set(this.widgetConfig.load(role));
      this.alertDismissed.set(false);
      this.layout.closeCustomize();
      // untracked: prevents widgets signal from being a reactive dependency of
      // this effect. Without it, syncFromRows() → widgets.set() would re-fire the
      // effect and call buildRowsFrom(), destroying the user's drag arrangement.
      untracked(() => this.buildArrays());
    });
  }

  openPendingRequests(): void {
    if (this.pendingEventCount > 0) {
      void this.router.navigate(['/admin/events'], { queryParams: { tab: 'pending' } });
      return;
    }

    void this.router.navigate(['/admin/places'], { queryParams: { status: 'pending' } });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.statsSubscription?.unsubscribe();
    this.trafficSubscription?.unsubscribe();
    this.activitySubscription?.unsubscribe();
    this.systemStatusSubscription?.unsubscribe();
    this.aiInsightsSubscription?.unsubscribe();
    this.pendingCountSubscription?.unsubscribe();
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup',   this.onMouseUp);
  }

  private loadPendingCount(): void {
    this.pendingCountSubscription?.unsubscribe();
    this.pendingCountSubscription = this.dashService.getPendingCount().subscribe({
      next: (pending) => {
        this.pendingEventCount = pending.eventCount;
        this.pendingPlaceCount = pending.placeCount;
        this.data.update((current) => current ? { ...current, pendingCount: pending.count } : current);
        this.cdr.markForCheck();
      },
    });
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
      this.nextRowId     = rows.length;
      this.newRowZone    = [];
      this.newRowZoneTop = [];
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

    this.nextRowId     = ri + 1;
    this.newRowZone    = [];
    this.newRowZoneTop = [];
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
    return ['new-row-zone', 'new-row-zone-top', ...this.visibleRows().map(r => r.id)];
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
    this.statsSubscription = this.dashService.getOverviewStats(role).subscribe({
      next: (stats) => {
        this.data.update((current) => current ? { ...current, stats } : current);
        this.cdr.markForCheck();
      },
    });
  }

  private loadTraffic(role: AdminRole): void {
    this.trafficSubscription?.unsubscribe();
    this.trafficSubscription = this.dashService.getTraffic(30).subscribe({
      next: (traffic) => {
        this.data.update((current) => current ? { ...current, traffic } : current);
        this.cdr.markForCheck();
      },
    });
  }

  private loadRecentActivity(role: AdminRole): void {
    this.activitySubscription?.unsubscribe();
    if (role === 'place_owner') return;
    this.activitySubscription = this.dashService.getRecentActivity(15).subscribe({
      next: (activity) => {
        this.data.update((current) => current ? { ...current, activity } : current);
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private loadSystemStatus(role: AdminRole): void {
    this.systemStatusSubscription?.unsubscribe();
    if (role === 'place_owner') return; // system status is admin-only
    this.systemStatusSubscription = this.dashService.getSystemStatus().subscribe({
      next: (systemStatus) => {
        this.data.update((current) => current ? { ...current, systemStatus } : current);
        this.cdr.markForCheck();
      },
    });
  }

  private loadAiInsights(role: AdminRole): void {
    this.aiInsightsSubscription?.unsubscribe();
    if (role === 'place_owner') return; // AI insights panel not available for place owners
    this.aiInsightsSubscription = this.dashService.getAiInsights().subscribe({
      next: (aiInsights) => {
        this.data.update((current) => current ? { ...current, aiInsights } : current);
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

  moveRowUp(rowIndex: number): void {
    if (rowIndex === 0) return;
    this.visibleRows.update(rows => {
      const updated = [...rows];
      [updated[rowIndex - 1], updated[rowIndex]] = [updated[rowIndex], updated[rowIndex - 1]];
      return updated;
    });
    this.syncFromRows();
  }

  moveRowDown(rowIndex: number): void {
    const rows = this.visibleRows();
    if (rowIndex >= rows.length - 1) return;
    this.visibleRows.update(r => {
      const updated = [...r];
      [updated[rowIndex], updated[rowIndex + 1]] = [updated[rowIndex + 1], updated[rowIndex]];
      return updated;
    });
    this.syncFromRows();
  }

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

    } else if (toId === 'new-row-zone-top') {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, 0);
      const widget   = this.newRowZoneTop.splice(0, 1)[0];
      widget.visible = true;
      this.visibleRows.update(rows => [
        { id: `row-${this.nextRowId++}`, items: [widget] },
        ...rows.map(r => r.id === fromId ? { ...r, items: [...r.items] } : r),
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

  startResize(event: MouseEvent, widget: WidgetConfig, direction: 'left' | 'right' = 'right'): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeState = { startX: event.clientX, startCols: widget.cols, widgetId: widget.id, direction };
    this.resizingId.set(widget.id);
    this.resizeCols.set(widget.cols);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup',   this.onMouseUp);
  }

  private handleResizeMove(event: MouseEvent): void {
    if (!this.resizeState) return;
    const rawDx     = event.clientX - this.resizeState.startX;
    const dx        = this.resizeState.direction === 'left' ? -rawDx : rawDx;
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
