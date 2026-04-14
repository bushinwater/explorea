import { CommonModule, Location } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { EventDetail } from '../../../core/models/event.model';
import { EventService } from '../../../core/services/event.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { DetailFooter } from '../../../shared/components/detail-footer/detail-footer';
import { EventCard } from '../../../shared/components/event-card/event-card';
import { ImageGallery } from '../../../shared/components/image-gallery/image-gallery';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, Sidebar, BottomNav, EventCard, ImageGallery, DetailFooter],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.css',
})
export class EventDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  event: EventDetail | null = null;
  loading = true;
  descriptionExpanded = false;
  persons = 1;

  private map?: MapLibreMap;
  private marker?: Marker;
  private mapInitialized = false;
  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private location: Location,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
      this.loading = true;
      this.event = null;
      this.descriptionExpanded = false;
      this.mapInitialized = false;
      this.marker?.remove();
      this.map?.remove();
      this.map = undefined;
      this.eventService.getBySlug(slug).subscribe({
        next: data => {
          this.event = data;
          this.loading = false;
          this.cdr.detectChanges();
          setTimeout(() => this.initMap(), 100);
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.marker?.remove();
    this.map?.remove();
  }

  private initMap(): void {
    if (this.mapInitialized || !this.mapContainer?.nativeElement || !this.event?.location) return;
    const { lat, lng } = this.event.location;
    this.mapInitialized = true;

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [lng, lat],
      zoom: 13,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    this.map.on('load', () => {
      this.marker = new maplibregl.Marker({ color: '#22c55e' })
        .setLngLat([lng, lat])
        .addTo(this.map!);
      this.cdr.detectChanges();
    });
  }

  get heroImage(): string {
    return this.event?.images?.[0]?.imageUrl ?? this.event?.previewImageUrl ?? '';
  }

  get shortDescription(): string {
    const desc = this.event?.description ?? '';
    if (desc.length <= 200) return desc;
    return desc.slice(0, 200) + '…';
  }

  get formattedDateRange(): string {
    if (!this.event) return '';
    const start = new Date(this.event.startDatetime);
    const end = new Date(this.event.endDatetime);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    const startStr = start.toLocaleDateString('sr-Latn-RS', opts);
    const endStr = end.toLocaleDateString('sr-Latn-RS', opts);
    if (startStr === endStr) return startStr;
    return `${startStr} – ${endStr}`;
  }

  get formattedTimeRange(): string {
    if (!this.event) return '';
    const start = new Date(this.event.startDatetime);
    const end = new Date(this.event.endDatetime);
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    return `${start.toLocaleTimeString('sr-Latn-RS', timeOpts)} – ${end.toLocaleTimeString('sr-Latn-RS', timeOpts)}`;
  }

  get locationText(): string {
    if (!this.event) return '';
    return [this.event.address, this.event.city?.name].filter(Boolean).join(', ');
  }

  get formattedDayNames(): string {
    if (!this.event) return '';
    const days = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
    const start = new Date(this.event.startDatetime);
    const end = new Date(this.event.endDatetime);
    const startDay = days[start.getDay()];
    const endDay = days[end.getDay()];
    if (startDay === endDay) return startDay;
    return `${startDay} – ${endDay}`;
  }

  get googleMapsUrl(): string {
    const loc = this.event?.location;
    if (!loc) return 'https://maps.google.com';
    return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  }

  buyTickets(): void {
    if (this.event?.ticketUrl) window.open(this.event.ticketUrl, '_blank');
  }

  goBack(): void {
    this.location.back();
  }

  navigateToEvents(): void {
    this.router.navigate(['/events']);
  }

  incrementPersons(): void {
    this.persons++;
  }

  decrementPersons(): void {
    if (this.persons > 1) this.persons--;
  }
}
