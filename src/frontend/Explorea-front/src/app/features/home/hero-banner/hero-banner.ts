import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, AfterViewInit,
  SimpleChanges, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, takeUntil } from 'rxjs/operators';
import { HeroBanner as HeroBannerModel, CityFilter } from '../../../core/models/home.model';
import { SearchService } from '../../../core/services/search.service';
import { SearchItem } from '../../../core/models/search.model';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './hero-banner.html',
  styleUrl: './hero-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBanner implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() banners: HeroBannerModel[] = [];
  @Input() cityFilters: CityFilter[] = [];
  @Input() set activeCityId(id: number | null) { this.selectedCityId = id; }
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

  // live search
  searchResults: SearchItem[] = [];
  showDropdown = false;
  searchLoading = false;

  private timer: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private searchService: SearchService,
  ) {}

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(50),
      distinctUntilChanged(),
      tap(q => {
        if (q.length < 2) {
          this.searchResults = [];
          this.showDropdown = false;
          this.searchLoading = false;
        } else {
          this.searchLoading = true;
        }
        this.cdr.markForCheck();
      }),
      filter(q => q.length >= 2),
      switchMap(q => this.searchService.search(q, 8)),
      takeUntil(this.destroy$),
    ).subscribe({
      next: result => {
        this.searchResults = result.results;
        this.showDropdown = result.results.length > 0;
        this.searchLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.searchLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

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
    this.destroy$.next();
    this.destroy$.complete();
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
      this.showDropdown = false;
      this.searchSubmitted.emit(this.searchQuery.trim());
    }
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.onSearch();
    if (event.key === 'Escape') {
      this.showDropdown = false;
    }
  }

  onSearchInput(value: string) {
    if (value.length >= 2) {
      this.searchLoading = true;
      this.cdr.markForCheck();
    } else {
      this.searchResults = [];
      this.showDropdown = false;
      this.searchLoading = false;
      this.cdr.markForCheck();
    }
    this.searchSubject.next(value);
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showDropdown = false;
      this.cdr.markForCheck();
    }, 200);
  }

  onSelectResult(item: SearchItem) {
    this.showDropdown = false;
    this.searchQuery = item.entity.name;
    const routeMap: Record<string, string> = {
      destination: 'destinations',
      place: 'places',
      event: 'events',
      activity: 'activities',
    };
    this.router.navigate([`/${routeMap[item.entityType] ?? item.entityType}`, item.entity.slug]);
  }

  getEntityIcon(type: string): string {
    const icons: Record<string, string> = {
      destination: 'place',
      place: 'store',
      event: 'event',
      activity: 'directions_run',
    };
    return icons[type] ?? 'search';
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const diff = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(diff) < 50) return;
    this.stopAutoAdvance();
    if (diff > 0) {
      this.next();
    } else {
      this.prev();
    }
    this.startAutoAdvance();
  }
}
