import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, AfterViewInit, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { HeroBanner as HeroBannerModel, CityFilter } from '../../../core/models/home.model';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './hero-banner.html',
  styleUrl: './hero-banner.css',
})
export class HeroBanner implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() banners: HeroBannerModel[] = [];
  @Input() cityFilters: CityFilter[] = [];
  @Output() citySelected = new EventEmitter<number | null>();
  @Output() searchSubmitted = new EventEmitter<string>();

  // [klon-poslednje, slide-0, slide-1, ..., slide-N, klon-prve]
  // trackIndex počinje od 1 (prva prava slika)
  trackIndex = 1;
  currentIndex = 0;       // za tačkice i tekst (0..N-1)
  noTransition = false;
  isTransitioning = false;

  selectedCityId: number | null = null;
  searchQuery = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['banners'] && this.banners.length && !this.timer) {
      this.startAutoAdvance();
    }
  }

  ngAfterViewInit() {
    if (this.banners.length && !this.timer) {
      this.startAutoAdvance();
    }
  }

  ngOnDestroy() {
    this.stopAutoAdvance();
  }

  get extendedSlides(): HeroBannerModel[] {
    if (!this.banners.length) return [];
    return [this.banners[this.banners.length - 1], ...this.banners, this.banners[0]];
  }

  get trackTranslate(): string {
    return `translateX(-${this.trackIndex * 100}%)`;
  }

  private startAutoAdvance() {
    this.timer = setInterval(() => {
      this.next();
      this.cdr.markForCheck();
    }, 5000);
  }

  private stopAutoAdvance() {
    if (this.timer) clearInterval(this.timer);
  }

  next() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.trackIndex++;
    this.currentIndex = (this.trackIndex - 1) % this.banners.length;
  }

  prev() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.trackIndex--;
    this.currentIndex = (this.trackIndex - 1 + this.banners.length) % this.banners.length;
  }

  goTo(index: number) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.trackIndex = index + 1;
    this.currentIndex = index;
    this.stopAutoAdvance();
    this.startAutoAdvance();
  }

  onTransitionEnd() {
    this.isTransitioning = false;

    // Stigli smo na klon-prve (kraj) → instant skok na pravu prvu
    if (this.trackIndex === this.banners.length + 1) {
      this.noTransition = true;
      this.trackIndex = 1;
      this.currentIndex = 0;
      setTimeout(() => { this.noTransition = false; this.cdr.markForCheck(); }, 50);
    }

    // Stigli smo na klon-poslednje (početak) → instant skok na pravu poslednju
    if (this.trackIndex === 0) {
      this.noTransition = true;
      this.trackIndex = this.banners.length;
      this.currentIndex = this.banners.length - 1;
      setTimeout(() => { this.noTransition = false; this.cdr.markForCheck(); }, 50);
    }
  }

  selectCity(id: number | null) {
    this.selectedCityId = id;
    this.citySelected.emit(id);
  }

  onSearch() {
    if (this.searchQuery.trim()) {
      this.searchSubmitted.emit(this.searchQuery.trim());
    }
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.onSearch();
  }
}
