import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import {
  EventFilterOption,
  EventImageItem,
  EventRow,
  UpdateEventPayload,
} from './admin-events.models';
import { AdminEventsService } from './admin-events.service';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const MAX_IMAGES = 10;

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
  cityId: number | null;
  destinationId: string | null;
  ticketUrl: string;
  isFeatured: boolean;
}

@Component({
  selector: 'app-event-edit-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './admin-event-edit-modal.component.html',
  styleUrl: './admin-event-modal.component.css',
})
export class EventEditModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) event!: EventRow;
  @Input() eventTypeOptions: EventFilterOption<number>[] = [];
  @Input() cityOptions: EventFilterOption<number>[] = [];
  @Input() destinationOptions: EventFilterOption<string>[] = [];

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EventRow>();

  @ViewChild('mapEl', { static: false }) private mapEl?: ElementRef<HTMLDivElement>;

  protected readonly form = signal<EditForm>({
    name: '', description: '', typeId: null, startDatetime: '', endDatetime: '',
    price: '', address: '', cityId: null, destinationId: null, ticketUrl: '', isFeatured: false,
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

  protected readonly MAX_IMAGES = MAX_IMAGES;

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  private lightStyle: any;
  private darkStyle: any;
  private themeObserver?: MutationObserver;
  private readonly sub = new Subscription();

  constructor(
    private readonly eventsService: AdminEventsService,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
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
      cityId: ev.cityId,
      destinationId: ev.destinationId,
      ticketUrl: ev.ticketUrl ?? '',
      isFeatured: ev.isFeatured,
    });
    this.mapLatitude.set(ev.latitude ?? null);
    this.mapLongitude.set(ev.longitude ?? null);
    this.images.set([...(ev.imageItems ?? [])]);
    this.heroImageId.set(ev.imageItems?.[0]?.id ?? null);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const lat = this.mapLatitude();
      const lng = this.mapLongitude();
      this.initMap(lat ?? undefined, lng ?? undefined);
    }, 50);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroyMap();
  }

  protected updateText(field: keyof Pick<EditForm, 'name' | 'description' | 'startDatetime' | 'endDatetime' | 'price' | 'address' | 'ticketUrl'>, value: string): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  protected updateNumber(field: 'typeId' | 'cityId', value: string): void {
    this.form.update(f => ({ ...f, [field]: value ? Number(value) : null }));
  }

  protected updateDestination(value: string): void {
    this.form.update(f => ({ ...f, destinationId: value || null }));
  }

  protected updateFeatured(checked: boolean): void {
    this.form.update(f => ({ ...f, isFeatured: checked }));
  }

  protected geocode(): void {
    const address = this.form().address.trim();
    if (!address) return;
    this.isGeocoding.set(true);
    this.http.get<any[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'sr,en' } },
    ).subscribe({
      next: (results) => {
        this.isGeocoding.set(false);
        if (results.length) this.setCoords(parseFloat(results[0].lat), parseFloat(results[0].lon));
        this.cdr.detectChanges();
      },
      error: () => { this.isGeocoding.set(false); this.cdr.detectChanges(); },
    });
  }

  protected submit(): void {
    if (this.isSaving()) return;

    const f = this.form();
    const errs: string[] = [];

    const name = f.name.trim();
    if (!name) errs.push('Naziv događaja je obavezan.');
    if (f.typeId === null) errs.push('Tip događaja je obavezan.');
    if (!f.startDatetime) errs.push('Datum i vreme početka su obavezni.');
    if (!f.endDatetime) errs.push('Datum i vreme završetka su obavezni.');

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
      cityId: f.cityId,
      destinationId: f.destinationId,
      ticketUrl: f.ticketUrl.trim() || null,
      isFeatured: f.isFeatured,
    };

    this.isSaving.set(true);
    this.errors.set([]);

    this.sub.add(
      this.eventsService.updateEvent(this.event.id, payload)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (row) => this.saved.emit(row),
          error: () => this.errors.set(['Čuvanje nije uspelo. Proverite podatke i pokušajte ponovo.']),
        }),
    );
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    const slots = MAX_IMAGES - this.images().length - this.uploadingCount();
    if (slots <= 0) {
      this.errors.set([`Maksimalan broj slika je ${MAX_IMAGES}.`]);
      this.cdr.detectChanges();
      return;
    }

    const toUpload = files.slice(0, slots);
    this.uploadingCount.update(n => n + toUpload.length);

    toUpload.forEach(file => {
      this.sub.add(
        this.eventsService.uploadEventImage(this.event.id, file).subscribe({
          next: (img) => {
            this.images.update(l => [...l, img]);
            this.uploadingCount.update(n => n - 1);
            if (this.heroImageId() === null) this.setHero(img.id);
            this.cdr.detectChanges();
          },
          error: () => {
            this.uploadingCount.update(n => n - 1);
            this.errors.set(['Greška pri otpremanju slike.']);
            this.cdr.detectChanges();
          },
        }),
      );
    });
  }

  protected setHero(imageId: string): void {
    if (this.isSettingHero()) return;
    this.isSettingHero.set(true);
    this.sub.add(
      this.eventsService.setHeroEventImage(this.event.id, imageId).subscribe({
        next: () => {
          this.heroImageId.set(imageId);
          this.isSettingHero.set(false);
          this.cdr.detectChanges();
        },
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
            const remaining = this.images();
            if (remaining.length > 0) this.setHero(remaining[0].id);
          }
          this.cdr.detectChanges();
        },
        error: () => { this.errors.set(['Greška pri brisanju slike.']); this.cdr.detectChanges(); },
      }),
    );
  }

  private async initMap(lat?: number, lng?: number): Promise<void> {
    if (!this.mapEl?.nativeElement) return;
    const base = await (await fetch(MAP_STYLE_URL)).json();
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
    this.map.on('click', (e) => {
      this.setCoords(e.lngLat.lat, e.lngLat.lng);
      this.cdr.detectChanges();
    });
    if (lat != null && lng != null) this.placeMarker(lat, lng);
    this.themeObserver = new MutationObserver(() => {
      const style = this.isDark ? this.darkStyle : this.lightStyle;
      if (style) this.map?.setStyle(style);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private setCoords(lat: number, lng: number): void {
    this.mapLatitude.set(lat);
    this.mapLongitude.set(lng);
    this.placeMarker(lat, lng);
    this.map?.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });
  }

  private placeMarker(lat: number, lng: number): void {
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
  }

  private destroyMap(): void {
    this.themeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
    this.marker = null;
  }

  private toLocalDatetime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
