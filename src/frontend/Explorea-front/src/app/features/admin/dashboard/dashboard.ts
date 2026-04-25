import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  OnDestroy, OnInit, WritableSignal, effect, signal, untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
  CdkDragDrop, CdkDragMove, moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';

import { DashboardAuthService }      from '../core/services/dashboard-auth.service';
import { DashboardService }           from '../core/services/dashboard.service';
import { LayoutService }              from '../core/services/layout.service';
import { WidgetConfigService }        from '../core/services/widget-config.service';
import { AdminUiPreferencesService }  from '../core/services/admin-ui-preferences.service';
import { DashboardData, WidgetConfig, WidgetId } from '../core/models/admin.models';

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
    CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
    StatCard, ActivityFeed, QuickActions, TrafficChart, SystemStatus, AiPanel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  data           = signal<DashboardData | null>(null);
  widgets        = signal<WidgetConfig[]>([]);
  alertDismissed = signal(false);
  dragging       = signal(false);
  activeSlotId   = signal<string | null>(null);  // 'rowId:slotIndex'
  resizingId     = signal<WidgetId | null>(null);
  resizeCols     = signal<1|2|3|4>(1);

  // SIGNAL — so Angular OnPush detects any mutation immediately
  visibleRows: WritableSignal<DashRow[]> = signal([]);
  newRowZone:  WidgetConfig[]            = [];
  hiddenWidgets: WidgetConfig[]          = [];

  private nextRowId = 0;
  // Shared empty buffers for gap-zone CDK drop lists (one per row ID)
  private readonly gapBuffers: Record<string, WidgetConfig[]> = {};

  private resizeState: {
    startX: number; startCols: 1|2|3|4; widgetId: WidgetId;
  } | null = null;

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

  // ===== Connected list IDs =====

  get allListIds(): string[] {
    const rows = this.visibleRows();
    return [
      ...rows.map(r => r.id),
      ...rows.map(r => `gap-${r.id}`),
      'new-row-zone',
      'panelList',
    ];
  }

  gapBuffer(rowId: string): WidgetConfig[] {
    return (this.gapBuffers[rowId] ??= []);
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

  onDragEnded(): void {
    this.dragging.set(false);
    this.activeSlotId.set(null);
  }

  // Fired continuously during drag — find nearest slot and highlight it
  onDragMoved(event: CdkDragMove): void {
    const pt    = event.pointerPosition;
    const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-slot-id]'));
    let found: string | null = null;
    let closestDist = Infinity;

    for (const el of slots) {
      const rowEl = el.closest<HTMLElement>('.dash-row');
      if (!rowEl) continue;
      const rowRect = rowEl.getBoundingClientRect();

      // Pointer must be within the row's vertical range (±24px tolerance)
      if (pt.y < rowRect.top - 24 || pt.y > rowRect.bottom + 24) continue;

      const slotRect    = el.getBoundingClientRect();
      const slotCenterX = slotRect.left + slotRect.width / 2;
      const dist        = Math.abs(pt.x - slotCenterX);

      if (dist < closestDist) {
        closestDist = dist;
        found = el.dataset['slotId'] ?? null;
      }
    }

    // Only activate a slot if pointer is within 80px of it
    if (closestDist > 80) found = null;
    if (found !== this.activeSlotId()) this.activeSlotId.set(found);
  }

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

    } else if (toId.startsWith('gap-')) {
      const targetRowId = toId.slice(4);
      const buf = this.gapBuffer(targetRowId);
      transferArrayItem(event.previousContainer.data, buf, event.previousIndex, 0);
      const widget = buf.splice(0, 1)[0];
      widget.visible = true;
      const insertIdx = this.visibleRows().findIndex(r => r.id === targetRowId);
      const newRow: DashRow = { id: `row-${this.nextRowId++}`, items: [widget] };
      this.visibleRows.update(rows => {
        const refreshed = rows.map(r => r.id === fromId ? { ...r, items: [...r.items] } : r);
        refreshed.splice(insertIdx === -1 ? refreshed.length : insertIdx, 0, newRow);
        return refreshed;
      });

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
    this.activeSlotId.set(null);
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
