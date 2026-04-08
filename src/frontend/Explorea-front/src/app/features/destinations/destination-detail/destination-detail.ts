import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DestinationService } from '../../../core/services/destination.service';
import { DestinationDetail } from '../../../core/models/destination.model';

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './destination-detail.html',
  styleUrls: ['./destination-detail.css']
})
export class DestinationDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private destinationService = inject(DestinationService);
  private cdr = inject(ChangeDetectorRef);

  destination: DestinationDetail | null = null;
  isLoading = true;
  error: string | null = null;

  selectedTab: 'places' | 'events' | 'activities' | 'reviews' = 'places';

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    console.log('slug:', slug);

    if (!slug) {
      this.error = 'Slug destinacije nije prosleđen.';
      this.isLoading = false;
      return;
    }

    this.destinationService.getDestinationBySlug(slug).subscribe({
      next: (data) => {
        console.log('destination data:', data);
        this.destination = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('destination error:', err);
        this.error = 'Greška pri učitavanju detalja destinacije.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setTab(tab: 'places' | 'events' | 'activities' | 'reviews'): void {
    this.selectedTab = tab;
  }

  get locationText(): string {
    if (!this.destination) return '';

    const city = this.destination.city?.name;
    const country = this.destination.country?.name;

    return [city, country].filter(Boolean).join(', ');
  }

  get galleryImages(): string[] {
    if (!this.destination) return [];

    const images = this.destination.images?.map(img => img.imageUrl) ?? [];

    if (images.length > 0) {
      return images;
    }

    return [
      this.destination.heroImageUrl,
      this.destination.previewImageUrl
    ].filter(Boolean) as string[];
  }

  get activeTabItems(): { id: string; name: string }[] {
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
}