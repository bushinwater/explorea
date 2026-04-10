import { Component, OnInit, inject, ChangeDetectorRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { DestinationService } from '../../../core/services/destination.service';
import {
  ActivityCard,
  DestinationDetail,
  EventCard,
  PlaceCard
} from '../../../core/models/destination.model';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

type DetailTab = 'places' | 'events' | 'activities' | 'reviews';
type TabItem = PlaceCard | EventCard | ActivityCard;

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, Sidebar, BottomNav],
  templateUrl: './destination-detail.html',
  styleUrls: ['./destination-detail.css']
})
export class DestinationDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private destinationService = inject(DestinationService);
  private cdr = inject(ChangeDetectorRef);

  private routeSub?: Subscription;
  private requestSub?: Subscription;

  destination: DestinationDetail | null = null;
  isLoading = true;
  error: string | null = null;
  selectedTab: DetailTab = 'places';

  lightboxOpen = false;
  selectedImageIndex = 0;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');

      if (!slug) {
        this.error = 'Slug destinacije nije prosleđen.';
        this.isLoading = false;
        this.destination = null;
        this.cdr.detectChanges();
        return;
      }

      this.loadDestination(slug);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.requestSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  private loadDestination(slug: string): void {
    this.requestSub?.unsubscribe();

    this.isLoading = true;
    this.error = null;
    this.destination = null;
    this.selectedTab = 'places';
    this.lightboxOpen = false;
    this.selectedImageIndex = 0;

    this.requestSub = this.destinationService.getDestinationBySlug(slug).subscribe({
      next: (data) => {
        this.destination = data;
        this.isLoading = false;
        window.scrollTo({ top: 0, behavior: 'auto' });
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Greška pri učitavanju detalja destinacije.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: DetailTab): void {
    this.selectedTab = tab;
  }

  get locationText(): string {
    if (!this.destination) return '';
    const city = this.destination.city?.name;
    const country = this.destination.country?.name;
    return [city, country].filter(Boolean).join(', ');
  }

  get heroImage(): string {
    if (!this.destination) return 'https://via.placeholder.com/1400x700';
    return (
      this.destination.heroImageUrl ||
      this.destination.previewImageUrl ||
      'https://via.placeholder.com/1400x700'
    );
  }

  get galleryImages(): string[] {
    if (!this.destination) return [];

    const images = this.destination.images?.map(img => img.imageUrl) ?? [];
    if (images.length > 0) return images;

    return [
      this.destination.heroImageUrl,
      this.destination.previewImageUrl
    ].filter(Boolean) as string[];
  }

  get activeTabItems(): TabItem[] {
    if (!this.destination) return [];

    switch (this.selectedTab) {
      case 'places':
        return this.destination.places;
      case 'events':
        return this.destination.events;
      case 'activities':
        return this.destination.activities;
      default:
        return [];
    }
  }

  trackById(_: number, item: TabItem): string {
    return item.id;
  }

  getItemImage(item: TabItem): string {
    return item.previewImageUrl || 'https://via.placeholder.com/300x200';
  }

  getItemTypeLabel(): string {
    switch (this.selectedTab) {
      case 'places':
        return 'Objekat';
      case 'events':
        return 'Događaj';
      case 'activities':
        return 'Aktivnost';
      default:
        return '';
    }
  }

  getItemLocationText(item: TabItem): string {
    if (this.isPlace(item)) {
      return item.address || item.country?.name || 'Lokacija nije dostupna';
    }

    if (this.isEvent(item)) {
      const city = item.city?.name;
      const country = item.country?.name;
      const address = item.address;
      return [address, city, country].filter(Boolean).join(', ') || 'Lokacija nije dostupna';
    }

    return item.country?.name || 'Lokacija nije dostupna';
  }

  getItemRating(item: TabItem): number | null {
    if (this.isPlace(item) || this.isActivity(item)) {
      return item.avgRating;
    }

    return null;
  }

  getItemMetaLabel(item: TabItem): string {
    if (this.isEvent(item)) {
      return 'Događaj';
    }

    return 'Ocena';
  }

  getItemRoute(item: TabItem): string[] {
    if (this.isPlace(item)) {
      return ['/places', item.slug];
    }

    if (this.isEvent(item)) {
      return ['/events', item.slug];
    }

    return ['/activities', item.slug];
  }

  openLightbox(index: number): void {
    this.selectedImageIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  prevImage(): void {
    const total = this.galleryImages.length;
    if (!total) return;
    this.selectedImageIndex = (this.selectedImageIndex - 1 + total) % total;
  }

  nextImage(): void {
    const total = this.galleryImages.length;
    if (!total) return;
    this.selectedImageIndex = (this.selectedImageIndex + 1) % total;
  }

  get currentLightboxImage(): string {
    return this.galleryImages[this.selectedImageIndex] || '';
  }

  get mapCoordinatesText(): string {
    const lat = this.destination?.location?.lat;
    const lng = this.destination?.location?.lng;

    if (lat == null || lng == null) return 'Lokacija nije dostupna';

    return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }

  get googleMapsUrl(): string {
    const lat = this.destination?.location?.lat;
    const lng = this.destination?.location?.lng;

    if (lat == null || lng == null) {
      return 'https://maps.google.com';
    }

    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  getStarsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  private isPlace(item: TabItem): item is PlaceCard {
    return this.selectedTab === 'places';
  }

  private isEvent(item: TabItem): item is EventCard {
    return this.selectedTab === 'events';
  }

  private isActivity(item: TabItem): item is ActivityCard {
    return this.selectedTab === 'activities';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) this.closeLightbox();
  }

  @HostListener('document:keydown.arrowLeft')
  onArrowLeft(): void {
    if (this.lightboxOpen) this.prevImage();
  }

  @HostListener('document:keydown.arrowRight')
  onArrowRight(): void {
    if (this.lightboxOpen) this.nextImage();
  }
}