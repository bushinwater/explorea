import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PlaceDetail } from '../../../core/models/place.model';
import { PlaceService } from '../../../core/services/place.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { PlaceCardComponent } from '../../../shared/components/place-card/place-card';

@Component({
  selector: 'app-place-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, Sidebar, BottomNav, PlaceCardComponent],
  templateUrl: './place-detail.html',
  styleUrl: './place-detail.css',
})
export class PlaceDetailComponent implements OnInit {
  place: PlaceDetail | null = null;
  loading = true;

  activeTab: 'details' | 'events' | 'reviews' = 'details';
  descriptionExpanded = false;
  activeImageIndex = 0;

  guests = 2;
  checkIn = '2024-08-15';
  checkOut = '2024-08-20';
  nights = 5;
  serviceFee = 45;

  constructor(
    private route: ActivatedRoute,
    private placeService: PlaceService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.placeService.getBySlug(slug).subscribe({
      next: (data) => {
        this.place = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get subtotal(): number {
    return (this.place?.pricePerNight ?? 0) * this.nights;
  }

  get total(): number {
    return this.subtotal + this.serviceFee;
  }

  get shortDescription(): string {
    const full = this.place?.description ?? '';
    return full.length > 300 ? full.slice(0, 300) + '…' : full;
  }

  get heroImage(): string {
    return this.place?.images?.[0]?.imageUrl ?? this.place?.previewImageUrl ?? '';
  }

  setTab(tab: 'details' | 'events' | 'reviews'): void {
    this.activeTab = tab;
  }

  toggleDescription(): void {
    this.descriptionExpanded = !this.descriptionExpanded;
  }

  nextImage(): void {
    if (!this.place) return;
    this.activeImageIndex = (this.activeImageIndex + 1) % this.place.images.length;
  }

  prevImage(): void {
    if (!this.place) return;
    this.activeImageIndex =
      (this.activeImageIndex - 1 + this.place.images.length) % this.place.images.length;
  }

  incrementGuests(): void {
    this.guests++;
  }

  decrementGuests(): void {
    if (this.guests > 1) this.guests--;
  }

  goBack(): void {
    this.location.back();
  }

  getMapUrl(): string {
    if (!this.place?.location) return '';
    const { lat, lng } = this.place.location;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
}
