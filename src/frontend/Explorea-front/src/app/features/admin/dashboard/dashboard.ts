import {
  ChangeDetectionStrategy, Component, OnInit, computed, effect, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, moveItemInArray } from '@angular/cdk/drag-drop';

import { DashboardAuthService }         from '../core/services/dashboard-auth.service';
import { DashboardService }    from '../core/services/dashboard.service';
import { LayoutService }       from '../core/services/layout.service';
import { WidgetConfigService } from '../core/services/widget-config.service';
import {
  DashboardData, WidgetConfig, WidgetId,
} from '../core/models/admin.models';

import { StatCard }      from './widgets/stat-card/stat-card';
import { ActivityFeed }  from './widgets/activity-feed/activity-feed';
import { QuickActions }  from './widgets/quick-actions/quick-actions';
import { TrafficChart }  from './widgets/traffic-chart/traffic-chart';
import { SystemStatus }  from './widgets/system-status/system-status';
import { AiPanel }       from './widgets/ai-panel/ai-panel';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
    StatCard, ActivityFeed, QuickActions,
    TrafficChart, SystemStatus, AiPanel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  data = signal<DashboardData | null>(null);
  widgets = signal<WidgetConfig[]>([]);
  alertDismissed = signal(false);

  constructor(
    public auth:          DashboardAuthService,
    private dashService:  DashboardService,
    public layout:        LayoutService,
    private widgetConfig: WidgetConfigService,
  ) {
    // Reload when role changes
    effect(() => {
      const role = this.auth.role();
      this.data.set(this.dashService.getData(role));
      this.widgets.set(this.widgetConfig.load(role));
      this.alertDismissed.set(false);
    });
  }

  ngOnInit(): void {}

  // ===== Widget visibility helpers =====

  isVisible(id: WidgetId): boolean {
    return this.widgetConfig.isVisible(this.widgets(), id, this.auth.role());
  }

  mainWidgets = computed(() =>
    this.widgets()
      .filter(w => w.zone === 'main')
      .sort((a, b) => a.order - b.order),
  );

  sideWidgets = computed(() =>
    this.widgets()
      .filter(w => w.zone === 'side')
      .sort((a, b) => a.order - b.order),
  );

  hasSideContent = computed(() =>
    this.sideWidgets().some(w => w.visible && w.roles.includes(this.auth.role())),
  );

  // ===== Alert =====

  get showAlert(): boolean {
    return !this.alertDismissed() && (this.data()?.pendingCount ?? 0) > 0;
  }

  // ===== Customizer =====

  /** Working copy used inside the drawer */
  drawerWidgets = signal<WidgetConfig[]>([]);

  openCustomizer(): void {
    this.drawerWidgets.set(this.widgets().map(w => ({ ...w })));
    this.layout.openCustomize();
  }

  closeCustomizer(): void {
    this.layout.closeCustomize();
  }

  saveCustomizer(): void {
    const updated = this.drawerWidgets().map((w, i) => ({
      ...w,
      order: this.drawerWidgets().filter(x => x.zone === w.zone).indexOf(w),
    }));
    this.widgets.set(updated);
    this.widgetConfig.save(this.auth.role(), updated);
    this.layout.closeCustomize();
  }

  resetCustomizer(): void {
    const reset = this.widgetConfig.reset(this.auth.role());
    this.widgets.set(reset);
    this.drawerWidgets.set(reset.map(w => ({ ...w })));
    this.widgetConfig.save(this.auth.role(), reset);
  }

  toggleWidgetVisibility(id: WidgetId): void {
    this.drawerWidgets.update(list =>
      list.map(w => w.id === id ? { ...w, visible: !w.visible } : w),
    );
  }

  dropMain(event: CdkDragDrop<WidgetConfig[]>): void {
    const arr = this.drawerWidgets().filter(w => w.zone === 'main');
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    const side = this.drawerWidgets().filter(w => w.zone === 'side');
    this.drawerWidgets.set([
      ...arr.map((w, i) => ({ ...w, order: i })),
      ...side,
    ]);
  }

  dropSide(event: CdkDragDrop<WidgetConfig[]>): void {
    const arr = this.drawerWidgets().filter(w => w.zone === 'side');
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    const main = this.drawerWidgets().filter(w => w.zone === 'main');
    this.drawerWidgets.set([
      ...main,
      ...arr.map((w, i) => ({ ...w, order: i })),
    ]);
  }

  drawerMain = computed(() =>
    this.drawerWidgets().filter(w => w.zone === 'main').sort((a, b) => a.order - b.order),
  );

  drawerSide = computed(() =>
    this.drawerWidgets().filter(w => w.zone === 'side').sort((a, b) => a.order - b.order),
  );

  isWidgetAvailableForRole(w: WidgetConfig): boolean {
    return w.roles.includes(this.auth.role());
  }
}
