import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import { AdminDestinationsService } from '../../../destinations/admin-destinations.service';
import { AdminPlacesService } from '../../../places/admin-places.service';
import { AdminEventsService } from '../../../events/admin-events.service';
import { AdminActivitiesService } from '../../../activities/admin-activities.service';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';
import { DestinationDependenciesResponse } from '../../../destinations/admin-destinations.models';
import { PlaceDependenciesResponse } from '../../../places/admin-places.models';

export interface DependencyItem {
  id: string;
  name: string;
  previewImageUrl: string | null;
  typeLabel: string | null;
  city: string | null;
  avgRating: number;
  entityType: string;
  startDate: string | null;
  viaPlaceName: string | null;
}

interface DepsState {
  eventCount: number;
  placeCount: number;
  activityCount: number;
  items: DependencyItem[];
  total: number;
}

@Component({
  selector: 'app-dependency-delete-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShellComponent],
  templateUrl: './dependency-delete-dialog.component.html',
  styleUrl: './dependency-delete-dialog.component.css',
})
export class DependencyDeleteDialogComponent implements OnInit {
  @Input({ required: true }) entityId!: string;
  @Input({ required: true }) entityName!: string;
  @Input({ required: true }) entityType!: 'destination' | 'place';

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly deleted = new EventEmitter<void>();

  protected readonly deps = signal<DepsState>({ eventCount: 0, placeCount: 0, activityCount: 0, items: [], total: 0 });
  protected readonly isLoading = signal(true);
  protected readonly activeTab = signal<'events' | 'places' | 'activities'>('events');
  protected readonly page = signal(1);
  protected readonly pageSize = 10;
  protected readonly isDeleting = signal(false);
  protected readonly deletingItemId = signal<string | null>(null);
  protected readonly isCascadeDeleting = signal(false);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.deps().total / this.pageSize))
  );

  protected readonly hasTabs = computed(() => {
    const d = this.deps();
    return (this.entityType === 'destination')
      ? [d.eventCount > 0, d.placeCount > 0, d.activityCount > 0].filter(Boolean).length > 1
      : false;
  });

  protected readonly tabsVisible = computed(() => {
    if (this.entityType !== 'destination') return [];
    const d = this.deps();
    const tabs: Array<{ key: 'events' | 'places' | 'activities'; label: string; count: number }> = [];
    if (d.eventCount > 0) tabs.push({ key: 'events', label: 'Dogadjaji', count: d.eventCount });
    if (d.placeCount > 0) tabs.push({ key: 'places', label: 'Objekti', count: d.placeCount });
    if (d.activityCount > 0) tabs.push({ key: 'activities', label: 'Aktivnosti', count: d.activityCount });
    return tabs;
  });

  protected readonly cascadeLabel = computed(() =>
    this.entityType === 'destination' ? 'Obriši sve i destinaciju' : 'Obriši sve i objekat'
  );

  protected readonly titleText = computed(() =>
    this.entityType === 'destination'
      ? `Destinacija „${this.entityName}" ima vezane entitete`
      : `Objekat „${this.entityName}" ima vezane dogadjaje`
  );

  protected readonly descriptionText = computed(() =>
    this.entityType === 'destination'
      ? 'Pre brisanja destinacije, obrišite ili premestite sve vezane dogadjaje, objekte i aktivnosti.'
      : 'Pre brisanja objekta, obrišite sve vezane dogadjaje.'
  );

  private readonly destService = inject(AdminDestinationsService);
  private readonly placesService = inject(AdminPlacesService);
  private readonly eventsService = inject(AdminEventsService);
  private readonly activitiesService = inject(AdminActivitiesService);
  protected readonly ui = inject(AdminUiPreferencesService);

  ngOnInit(): void {
    this.loadDeps();
  }

  protected setTab(tab: 'events' | 'places' | 'activities'): void {
    this.activeTab.set(tab);
    this.page.set(1);
    this.loadDeps();
  }

  protected goToPage(p: number): void {
    const clamped = Math.min(Math.max(p, 1), this.totalPages());
    this.page.set(clamped);
    this.loadDeps();
  }

  protected deleteItem(item: DependencyItem): void {
    this.deletingItemId.set(item.id);
    const obs = item.entityType === 'event'
      ? this.eventsService.deleteEvent(item.id)
      : item.entityType === 'place'
        ? this.placesService.delete(item.id)
        : this.activitiesService.delete(item.id);

    obs.subscribe({
      next: () => {
        this.deletingItemId.set(null);
        this.page.set(1);
        this.loadDeps();
      },
      error: () => {
        this.deletingItemId.set(null);
      },
    });
  }

  protected confirmCascadeDelete(): void {
    this.isCascadeDeleting.set(true);
    const obs = this.entityType === 'destination'
      ? this.destService.deleteCascade(this.entityId)
      : this.placesService.deleteCascade(this.entityId);

    obs.subscribe({
      next: () => {
        this.isCascadeDeleting.set(false);
        this.deleted.emit();
      },
      error: () => {
        this.isCascadeDeleting.set(false);
      },
    });
  }

  protected requestClose(): void {
    this.closed.emit();
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected formatRating(r: number): string {
    return r.toFixed(1);
  }

  private loadDeps(): void {
    this.isLoading.set(true);
    const tab = this.activeTab();
    const pg = this.page();

    if (this.entityType === 'destination') {
      this.destService.getDependencies(this.entityId, tab, pg, this.pageSize).subscribe({
        next: (res: DestinationDependenciesResponse) => {
          const state: DepsState = {
            eventCount: res.eventCount,
            placeCount: res.placeCount,
            activityCount: res.activityCount,
            items: res.items as DependencyItem[],
            total: res.total,
          };
          this.deps.set(state);
          if (tab === 'events' && res.eventCount === 0 && res.placeCount > 0) {
            this.activeTab.set('places');
            this.loadDeps();
            return;
          }
          if (tab === 'events' && res.eventCount === 0 && res.activityCount > 0) {
            this.activeTab.set('activities');
            this.loadDeps();
            return;
          }
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else {
      this.placesService.getPlaceDependencies(this.entityId, pg, this.pageSize).subscribe({
        next: (res: PlaceDependenciesResponse) => {
          this.deps.set({
            eventCount: res.eventCount,
            placeCount: res.placeCount,
            activityCount: res.activityCount,
            items: res.items as DependencyItem[],
            total: res.total,
          });
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    }
  }
}
