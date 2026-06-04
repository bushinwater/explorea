import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import {
  CountryOption,
  RegionWithCountry,
  DestinationSearchItem,
  PlaceSearchItem,
  EventFilterOption,
  EventImageItem,
  EventRow,
  UpdateEventPayload,
  InterestTagOption,
} from './admin-events.models';
import { AdminEventsService } from './admin-events.service';
import { FilterDefinition, LookupService } from '../../../core/services/lookup.service';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';
import { MAP_STYLE_URL, patchStyleSources } from '../../../core/utils/map-style.utils';

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

interface EditForm {
  name: string;
  description: string;
  typeId: number | null;
  startDatetime: string;
  endDatetime: string;
  price: string;
  address: string;
  destinationId: string | null;
  placeId: string | null;
  ticketUrl: string;
  isFeatured: boolean;
  extraFilters: Record<string, string>;
}

@Component({
  selector: 'app-event-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './admin-event-edit-modal.component.html',
  styleUrl: './admin-event-modal.component.css',
})
export class EventEditModalComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) event!: EventRow;
  @Input() eventTypeOptions: EventFilterOption<number>[] = [];
  @Input() lockedRegionId: number | null = null;
  @Input() closing = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EventRow>();

  @ViewChild('mapEl', { static: false }) private mapEl?: ElementRef<HTMLDivElement>;

  protected readonly form = signal<EditForm>({
    name: '', description: '', typeId: null, startDatetime: '', endDatetime: '',
    price: '', address: '', destinationId: null, placeId: null, ticketUrl: '', isFeatured: false, extraFilters: {},
  });
  protected readonly errors = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly isGeocoding = signal(false);
  protected readonly mapLatitude = signal<number | null>(null);
  protected readonly mapLongitude = signal<number | null>(null);

  protected readonly images = signal<EventImageItem[]>([]);
  protected readonly heroImageId = signal<string | null>(null);
  protected readonly uploadingCount = signal(0);
  protected readonly isSettingHero = signal(false);

  protected readonly allInterestTags = signal<InterestTagOption[]>([]);
  protected readonly selectedInterestIds = signal<number[]>([]);

  // Location cascade
  protected readonly countries = signal<CountryOption[]>([]);
  protected readonly allRegions = signal<RegionWithCountry[]>([]);
  protected readonly selectedCountryId = signal<number | null>(null);
  protected readonly selectedRegionId = signal<number | null>(null);
  protected readonly filteredRegions = computed(() => {
    const cid = this.selectedCountryId();
    const all = this.allRegions();
    return cid === null ? all : all.filter(r => r.countryId === cid);
  });

  // Destination search
  protected readonly destinationQuery = signal('');
  protected readonly destinationResults = signal<DestinationSearchItem[]>([]);
  protected readonly showDestResults = signal(false);
  protected readonly isSearchingDest = signal(false);
  protected readonly selectedDestName = signal('');

  // Place search
  protected readonly placeQuery = signal('');
  protected readonly placeResults = signal<PlaceSearchItem[]>([]);
  protected readonly showPlaceResults = signal(false);
  protected readonly isSearchingPlaces = signal(false);
  protected readonly selectedPlaceName = signal('');

  // Filter definitions
  protected readonly filterDefs = signal<FilterDefinition[]>([]);

  // Add new type
  protected readonly showAddType = signal(false);
  protected readonly newTypeName = signal('');
  protected readonly isAddingType = signal(false);
  protected readonly extraTypes = signal<EventFilterOption<number>[]>([]);
  get allTypeOptions(): EventFilterOption<number>[] {
    return [...this.eventTypeOptions, ...this.extraTypes()];
  }

  // Add new filter definition
  protected readonly showAddFilter = signal(false);
  protected readonly newFilterKey = signal('');
  protected readonly newFilterLabel = signal('');
  protected readonly newFilterType = signal('boolean');
  protected readonly isAddingFilter = signal(false);

  protected readonly MAX_IMAGES = MAX_IMAGES;

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private lightStyle: any;
  private darkStyle: any;
  private themeObserver?: MutationObserver;
  private readonly sub = new Subscription();
  private readonly destSearch$ = new Subject<string>();
  private readonly placeSearch$ = new Subject<string>();

  constructor(
    private readonly eventsService: AdminEventsService,
    private readonly lookupService: LookupService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    protected readonly ui: AdminUiPreferencesService,
  ) {}

  ngOnInit(): void {
    const ev = this.event;
    this.form.set({
      name: ev.name,
      description: ev.description ?? '',
      typeId: ev.typeId,
      startDatetime: ev.startDate ? this.toLocalDatetime(ev.startDate) : '',
      endDatetime: ev.endDate ? this.toLocalDatetime(ev.endDate) : '',
      price: ev.price != null ? String(ev.price) : '',
      address: ev.address ?? '',
      destinationId: ev.destinationId,
      placeId: ev.placeId ?? null,
      ticketUrl: ev.ticketUrl ?? '',
      isFeatured: ev.isFeatured,
      extraFilters: ev.extraFilters ?? {},
    });
    this.mapLatitude.set(ev.latitude ?? null);
    this.mapLongitude.set(ev.longitude ?? null);

    // Load full event detail from API (list row may have null typeId / no extraFilters)
    this.sub.add(
      this.eventsService.getEventDetail(ev.id).subscribe({
        next: detail => {
          this.images.set([...(detail.imageItems ?? [])]);
          const heroImg = detail.imageItems?.find(i => i.imageUrl === detail.heroImageUrl);
          this.heroImageId.set(heroImg?.id ?? detail.imageItems?.[0]?.id ?? null);
          // Refresh typeId, extraFilters, destinationId and placeId from full detail
          const freshTypeId = detail.typeId;
          const freshExtraFilters = detail.extraFilters ?? {};
          const freshDestId = detail.destinationId;
          const freshPlaceId = detail.placeId;
          this.form.update(f => ({
            ...f,
            typeId: freshTypeId ?? f.typeId,
            extraFilters: Object.keys(freshExtraFilters).length ? freshExtraFilters : f.extraFilters,
            destinationId: freshDestId ?? f.destinationId,
            placeId: freshPlaceId ?? f.placeId,
          }));
          if (freshTypeId !== null) this.loadFilterDefs(freshTypeId);
          // If list item didn't have destinationId, populate cascade from detail
          if (freshDestId && !ev.destinationId) {
            this.sub.add(
              this.eventsService.getDestinationById(freshDestId).subscribe({
                next: dest => {
                  if (dest) {
                    this.selectedDestName.set(dest.name);
                    this.destinationQuery.set(dest.name);
                    if (dest.countryId != null) this.selectedCountryId.set(dest.countryId);
                    if (dest.regionId != null) this.selectedRegionId.set(dest.regionId);
                  }
                  this.cdr.detectChanges();
                },
                error: () => {},
              }),
            );
          }
          if (freshPlaceId && !ev.placeId) {
            this.sub.add(
              this.eventsService.getPlaceById(freshPlaceId).subscribe({
                next: place => {
                  if (place) { this.selectedPlaceName.set(place.name); this.placeQuery.set(place.name); }
                  this.cdr.detectChanges();
                },
                error: () => {},
              }),
            );
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.images.set([...(ev.imageItems ?? [])]);
          this.heroImageId.set(ev.imageItems?.[0]?.id ?? null);
          if (ev.typeId !== null) this.loadFilterDefs(ev.typeId);
        },
      }),
    );

    // Load interests
    this.sub.add(
      this.eventsService.getEventInterests(ev.id).subscribe({
        next: tags => {
          this.allInterestTags.set(tags);
          this.selectedInterestIds.set(tags.filter(t => t.isAssigned).map(t => t.id));
          this.cdr.detectChanges();
        },
        error: () => {},
      }),
    );

    // Load filter definitions from initial ev (shown while detail loads)
    if (ev.typeId !== null) this.loadFilterDefs(ev.typeId);

    // Pre-populate destination name and auto-fill country/region
    if (ev.destinationId) {
      this.sub.add(
        this.eventsService.getDestinationById(ev.destinationId).subscribe({
          next: dest => {
            if (dest) {
              this.selectedDestName.set(dest.name);
              this.destinationQuery.set(dest.name);
              if (dest.countryId != null) this.selectedCountryId.set(dest.countryId);
              if (dest.regionId != null) this.selectedRegionId.set(dest.regionId);
            }
            this.cdr.detectChanges();
          },
          error: () => {},
        }),
      );
    }

    // Pre-populate place name
    if (ev.placeId) {
      this.sub.add(
        this.eventsService.getPlaceById(ev.placeId).subscribe({
          next: place => {
            if (place) { this.selectedPlaceName.set(place.name); this.placeQuery.set(place.name); }
            this.cdr.detectChanges();
          },
          error: () => {},
        }),
      );
    }

    // Load location data
    this.sub.add(this.eventsService.getCountries().subscribe({
      next: c => { this.countries.set(c); this.cdr.detectChanges(); }, error: () => {},
    }));
    this.sub.add(this.eventsService.getRegionsWithCountry().subscribe({
      next: r => {
        this.allRegions.set(r);
        this.applyRegionLock();
        this.cdr.detectChanges();
      },
      error: () => {},
    }));
  }

  ngAfterViewInit(): void {
    this.sub.add(
      this.destSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(q => {
        if (!q.trim()) { this.destinationResults.set([]); this.showDestResults.set(false); this.isSearchingDest.set(false); this.cdr.detectChanges(); return; }
        this.isSearchingDest.set(true);
        this.eventsService.searchDestinations(q, this.selectedRegionId() ?? undefined).subscribe({
          next: r => { this.destinationResults.set(r); this.showDestResults.set(r.length > 0); this.isSearchingDest.set(false); this.cdr.detectChanges(); },
          error: () => { this.isSearchingDest.set(false); this.cdr.detectChanges(); },
        });
      }),
    );
    this.sub.add(
      this.placeSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(q => {
        if (!q.trim()) { this.placeResults.set([]); this.showPlaceResults.set(false); this.isSearchingPlaces.set(false); this.cdr.detectChanges(); return; }
        this.isSearchingPlaces.set(true);
        this.eventsService.searchPlaces(q, this.form().destinationId ?? undefined).subscribe({
          next: r => { this.placeResults.set(r); this.showPlaceResults.set(r.length > 0); this.isSearchingPlaces.set(false); this.cdr.detectChanges(); },
          error: () => { this.isSearchingPlaces.set(false); this.cdr.detectChanges(); },
        });
      }),
    );

    setTimeout(() => {
      const lat = this.mapLatitude();
      const lng = this.mapLongitude();
      this.initMap(lat ?? undefined, lng ?? undefined);
    }, 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lockedRegionId'] && this.lockedRegionId !== null) {
      this.applyRegionLock();
    }
  }

  private applyRegionLock(): void {
    if (this.lockedRegionId === null) return;
    const region = this.allRegions().find(r => r.id === this.lockedRegionId);
    if (region) {
      this.selectedRegionId.set(region.id);
      if (region.countryId != null) this.selectedCountryId.set(region.countryId);
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroyMap();
  }

  protected updateText(field: keyof Pick<EditForm, 'name' | 'description' | 'startDatetime' | 'endDatetime' | 'price' | 'address' | 'ticketUrl'>, value: string): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  protected updateType(value: string): void {
    const typeId = value ? Number(value) : null;
    this.form.update(f => ({ ...f, typeId, extraFilters: {} }));
    this.filterDefs.set([]);
    if (typeId !== null) this.loadFilterDefs(typeId);
  }

  protected updateExtraFilter(key: string, value: string | boolean): void {
    this.form.update(f => {
      const ef = { ...f.extraFilters };
      if (value === false || value === '') delete ef[key];
      else ef[key] = String(value);
      return { ...f, extraFilters: ef };
    });
  }

  protected updateFeatured(checked: boolean): void {
    this.form.update(f => ({ ...f, isFeatured: checked }));
  }

  // Country → Region cascade
  protected updateCountry(value: string): void {
    this.selectedCountryId.set(value ? Number(value) : null);
    this.selectedRegionId.set(null);
    this.clearDestination();
  }

  protected updateRegion(value: string): void {
    this.selectedRegionId.set(value ? Number(value) : null);
    this.clearDestination();
  }

  // Destination typeahead
  protected onDestinationInput(query: string): void {
    this.destinationQuery.set(query);
    if (!query.trim()) { this.clearDestination(); return; }
    this.destSearch$.next(query);
  }

  protected selectDestination(item: DestinationSearchItem): void {
    this.form.update(f => ({ ...f, destinationId: item.id, placeId: null }));
    this.selectedDestName.set(item.name);
    this.destinationQuery.set(item.name);
    this.destinationResults.set([]);
    this.showDestResults.set(false);
    if (item.countryId != null) {
      this.selectedCountryId.set(item.countryId);
    } else if (item.regionId != null) {
      const region = this.allRegions().find(r => r.id === item.regionId);
      if (region?.countryId != null) this.selectedCountryId.set(region.countryId);
    }
    if (item.regionId != null) this.selectedRegionId.set(item.regionId);
    if (item.latitude != null && item.longitude != null) {
      this.setCoords(item.latitude, item.longitude);
    }
    this.clearPlaceOnly();
    this.cdr.detectChanges();
  }

  protected clearDestination(): void {
    this.form.update(f => ({ ...f, destinationId: null, placeId: null }));
    this.selectedDestName.set('');
    this.destinationQuery.set('');
    this.destinationResults.set([]);
    this.showDestResults.set(false);
    this.clearPlaceOnly();
  }

  protected hideDestResults(): void {
    setTimeout(() => { this.showDestResults.set(false); this.cdr.detectChanges(); }, 150);
  }

  // Place typeahead
  protected onPlaceInput(query: string): void {
    this.placeQuery.set(query);
    if (!query.trim()) { this.clearPlaceOnly(); return; }
    this.placeSearch$.next(query);
  }

  protected selectPlace(item: PlaceSearchItem): void {
    this.form.update(f => ({ ...f, placeId: item.id }));
    this.selectedPlaceName.set(item.name);
    this.placeQuery.set(item.name);
    this.placeResults.set([]);
    this.showPlaceResults.set(false);
    this.cdr.detectChanges();

    // Fetch full place detail to get coords, destinationId + countryId, then chain destination for regionId
    this.sub.add(
      this.eventsService.getPlaceById(item.id).subscribe({
        next: place => {
          if (!place) { this.cdr.detectChanges(); return; }
          if (place.latitude != null && place.longitude != null) {
            this.setCoords(place.latitude, place.longitude);
          }
          if (place.destinationId) {
            this.form.update(f => ({ ...f, destinationId: place.destinationId! }));
            this.selectedDestName.set(place.destinationName ?? '');
            this.destinationQuery.set(place.destinationName ?? '');
            this.sub.add(
              this.eventsService.getDestinationById(place.destinationId).subscribe({
                next: dest => {
                  if (dest?.regionId != null) this.selectedRegionId.set(dest.regionId);
                  const cid = dest?.countryId ?? place.countryId;
                  if (cid != null) {
                    this.selectedCountryId.set(cid);
                  } else if (dest?.regionId != null) {
                    const r = this.allRegions().find(reg => reg.id === dest.regionId);
                    if (r?.countryId != null) this.selectedCountryId.set(r.countryId);
                  }
                  if (place.latitude == null && dest?.latitude != null && dest.longitude != null) {
                    this.setCoords(dest.latitude, dest.longitude);
                  }
                  this.cdr.detectChanges();
                },
                error: () => {
                  if (place.countryId != null) this.selectedCountryId.set(place.countryId);
                  this.cdr.detectChanges();
                },
              }),
            );
          } else {
            if (place.countryId != null) this.selectedCountryId.set(place.countryId);
            this.cdr.detectChanges();
          }
        },
        error: () => {},
      }),
    );
  }

  protected clearPlaceOnly(): void {
    this.form.update(f => ({ ...f, placeId: null }));
    this.selectedPlaceName.set('');
    this.placeQuery.set('');
    this.placeResults.set([]);
    this.showPlaceResults.set(false);
  }

  protected hidePlaceResults(): void {
    setTimeout(() => { this.showPlaceResults.set(false); this.cdr.detectChanges(); }, 150);
  }

  // Interests
  protected toggleInterest(id: number): void {
    const cur = this.selectedInterestIds();
    this.selectedInterestIds.set(cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id]);
  }

  // Geocode
  protected geocode(): void {
    const address = this.form().address.trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.http.get<any[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'sr,en' } },
    ).subscribe({
      next: r => { this.isGeocoding.set(false); if (r.length) this.setCoords(parseFloat(r[0].lat), parseFloat(r[0].lon)); this.cdr.detectChanges(); },
      error: () => { this.isGeocoding.set(false); this.cdr.detectChanges(); },
    });
  }

  // Add new event type
  protected toggleAddType(): void {
    this.showAddType.update(v => !v);
    this.newTypeName.set('');
  }

  protected addNewType(): void {
    const name = this.newTypeName().trim();
    if (!name || this.isAddingType()) return;
    this.isAddingType.set(true);
    this.sub.add(
      this.eventsService.createEventType(name).subscribe({
        next: opt => {
          this.extraTypes.update(t => [...t, opt]);
          this.form.update(f => ({ ...f, typeId: opt.value, extraFilters: {} }));
          this.loadFilterDefs(opt.value);
          this.isAddingType.set(false);
          this.showAddType.set(false);
          this.newTypeName.set('');
          this.cdr.detectChanges();
        },
        error: () => {
          this.errors.set(['Kreiranje novog tipa nije uspelo.']);
          this.isAddingType.set(false);
          this.cdr.detectChanges();
        },
      }),
    );
  }

  // Add new filter definition
  protected toggleAddFilter(): void {
    this.showAddFilter.update(v => !v);
    this.newFilterKey.set('');
    this.newFilterLabel.set('');
    this.newFilterType.set('boolean');
  }

  protected addNewFilter(): void {
    const typeId = this.form().typeId;
    const key = this.newFilterKey().trim();
    const label = this.newFilterLabel().trim();
    const type = this.newFilterType();
    if (!typeId || !key || !label || this.isAddingFilter()) return;
    this.isAddingFilter.set(true);
    this.sub.add(
      this.eventsService.createFilterDefinition(typeId, key, label, type).subscribe({
        next: def => {
          this.filterDefs.update(d => [...d, def]);
          this.isAddingFilter.set(false);
          this.showAddFilter.set(false);
          this.cdr.detectChanges();
        },
        error: () => {
          this.errors.set(['Kreiranje filtera nije uspelo.']);
          this.isAddingFilter.set(false);
          this.cdr.detectChanges();
        },
      }),
    );
  }

  protected submit(): void {
    if (this.isSaving()) return;

    const f = this.form();
    const errs: string[] = [];
    const name = f.name.trim();
    if (!name) errs.push(this.ui.t('events.modal.validation.name'));
    if (f.typeId === null) errs.push(this.ui.t('events.modal.validation.type'));
    if (!f.startDatetime) errs.push(this.ui.t('events.modal.validation.start'));
    if (!f.endDatetime) errs.push(this.ui.t('events.modal.validation.end'));
    const startDate = f.startDatetime ? new Date(f.startDatetime) : null;
    const endDate = f.endDatetime ? new Date(f.endDatetime) : null;
    if (startDate && isNaN(startDate.getTime())) errs.push('Datum početka nije validan.');
    if (endDate && isNaN(endDate.getTime())) errs.push('Datum završetka nije validan.');
    if (startDate && endDate && endDate <= startDate) errs.push('Datum završetka mora biti posle datuma početka.');
    const price = f.price.trim() ? Number(f.price.trim().replace(',', '.')) : null;
    if (price !== null && (isNaN(price) || price < 0)) errs.push('Cena mora biti pozitivan broj.');
    if (errs.length) { this.errors.set(errs); return; }

    const payload: UpdateEventPayload = {
      name,
      typeId: f.typeId!,
      startDatetime: startDate!.toISOString(),
      endDatetime: endDate!.toISOString(),
      description: f.description.trim() || null,
      price,
      address: f.address.trim() || null,
      latitude: this.mapLatitude(),
      longitude: this.mapLongitude(),
      cityId: null,
      destinationId: f.destinationId,
      placeId: f.placeId,
      ticketUrl: f.ticketUrl.trim() || null,
      isFeatured: f.isFeatured,
      extraFilters: Object.keys(f.extraFilters).length ? f.extraFilters : undefined,
    };

    this.isSaving.set(true);
    this.errors.set([]);
    this.sub.add(
      this.eventsService.updateEvent(this.event.id, payload).subscribe({
        next: row => {
          this.eventsService.setEventInterests(this.event.id, this.selectedInterestIds()).subscribe({
            next: () => { this.isSaving.set(false); this.saved.emit(row); },
            error: () => { this.isSaving.set(false); this.saved.emit(row); },
          });
        },
        error: () => {
          this.isSaving.set(false);
          this.errors.set(['Čuvanje nije uspelo. Proverite podatke i pokušajte ponovo.']);
        },
      }),
    );
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawFiles = Array.from(input.files ?? []);
    input.value = '';
    const files = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (files.length < rawFiles.length) { this.errors.set(['Slike moraju biti manje od 5 MB.']); }
    if (!files.length) { this.cdr.detectChanges(); return; }
    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) { this.errors.set([`Maksimalan broj slika je ${MAX_IMAGES}.`]); this.cdr.detectChanges(); return; }
    const toUpload = files.slice(0, slots);
    this.uploadingCount.update(n => n + toUpload.length);
    toUpload.forEach(file => {
      this.sub.add(
        this.eventsService.uploadEventImage(this.event.id, file).subscribe({
          next: img => {
            this.images.update(l => [...l, img]);
            this.uploadingCount.update(n => n - 1);
            if (this.heroImageId() === null) this.setHero(img.id);
            this.cdr.detectChanges();
          },
          error: () => { this.uploadingCount.update(n => n - 1); this.errors.set(['Greška pri otpremanju slike.']); this.cdr.detectChanges(); },
        }),
      );
    });
  }

  protected setHero(imageId: string): void {
    if (this.isSettingHero()) return;
    this.isSettingHero.set(true);
    this.sub.add(
      this.eventsService.setHeroEventImage(this.event.id, imageId).subscribe({
        next: () => { this.heroImageId.set(imageId); this.isSettingHero.set(false); this.cdr.detectChanges(); },
        error: () => { this.isSettingHero.set(false); this.cdr.detectChanges(); },
      }),
    );
  }

  protected removeImage(imageId: string): void {
    this.sub.add(
      this.eventsService.deleteEventImage(this.event.id, imageId).subscribe({
        next: () => {
          this.images.update(l => l.filter(i => i.id !== imageId));
          if (this.heroImageId() === imageId) {
            this.heroImageId.set(null);
            const rem = this.images();
            if (rem.length > 0) this.setHero(rem[0].id);
          }
          this.cdr.detectChanges();
        },
        error: () => { this.errors.set(['Greška pri brisanju slike.']); this.cdr.detectChanges(); },
      }),
    );
  }

  private loadFilterDefs(typeId: number): void {
    this.sub.add(
      this.lookupService.getFilterDefinitions('event', typeId).subscribe({
        next: defs => { this.filterDefs.set(defs); this.cdr.detectChanges(); },
        error: () => this.filterDefs.set([]),
      }),
    );
  }

  private async initMap(lat?: number, lng?: number): Promise<void> {
    if (!this.mapEl?.nativeElement) return;
    const base = patchStyleSources(await (await fetch(MAP_STYLE_URL)).json());
    this.lightStyle = this.buildThemedStyle(base, LIGHT);
    this.darkStyle = this.buildThemedStyle(base, DARK);
    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: this.isDark ? this.darkStyle : this.lightStyle,
      center: lat != null && lng != null ? [lng, lat] : [20.9, 44.0],
      zoom: lat != null && lng != null ? 12 : 6,
      attributionControl: false,
    });
    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    this.map.on('click', e => { this.setCoords(e.lngLat.lat, e.lngLat.lng); this.cdr.detectChanges(); });
    if (lat != null && lng != null) this.placeMarker(lat, lng);
    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private setCoords(lat: number, lng: number): void {
    this.mapLatitude.set(lat); this.mapLongitude.set(lng);
    this.placeMarker(lat, lng);
    this.map?.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });
  }

  private placeMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new maplibregl.Marker({ color: '#28694c', draggable: true }).setLngLat([lng, lat]).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLngLat();
        this.mapLatitude.set(pos.lat); this.mapLongitude.set(pos.lng);
        this.cdr.detectChanges();
      });
    }
  }

  private destroyMap(): void {
    this.themeObserver?.disconnect();
    this.map?.remove();
    this.map = null; this.marker = null;
  }

  private toLocalDatetime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private get isDark(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  private luminance(hex: string): number {
    if (!hex?.startsWith('#') || hex.length < 7) return 0;
    return parseInt(hex.slice(1,3),16)*0.299 + parseInt(hex.slice(3,5),16)*0.587 + parseInt(hex.slice(5,7),16)*0.114;
  }

  private buildThemedStyle(base: any, p: typeof DARK): any {
    const themed = JSON.parse(JSON.stringify(base));
    themed.layers = themed.layers.map((layer: any) => {
      const id: string = layer.id ?? '';
      if (!layer.paint) return layer;
      delete layer.paint['fill-pattern'];
      switch (layer.type) {
        case 'background': layer.paint['background-color'] = p.land; break;
        case 'fill': {
          let c: string;
          if (/building/.test(id)) { layer.paint['fill-opacity'] = 0; break; }
          if (/water|ocean|sea|bay|lake|river|pond|reservoir/.test(id)) { c = p.water; layer.paint['fill-outline-color'] = p.water; }
          else if (/forest|wood|scrub|grass|park|nature|garden|vegetation|landcover/.test(id)) { c = p.park; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.park; }
          else if (/landuse/.test(id)) { c = p.park; }
          else if (/sand|beach|desert|bare/.test(id)) { c = p.sand; }
          else if (/pedestrian|plaza|square|footway|paved|civic|commercial|retail|amenity|transit/.test(id)) { c = p.pedestrian; if (layer.paint['fill-outline-color']) layer.paint['fill-outline-color'] = p.pedestrian; }
          else if (/bridge/.test(id)) { c = p.bridge; }
          else { const orig = typeof layer.paint['fill-color']==='string' ? layer.paint['fill-color'] : ''; c = this.luminance(orig)>128 ? p.surface : p.land; }
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
          else { const orig = typeof layer.paint['line-color']==='string' ? layer.paint['line-color'] : ''; c = this.luminance(orig)>128 ? p.road_minor : p.land; }
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
}
