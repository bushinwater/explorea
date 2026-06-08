import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewDto } from '../../../core/models/home.model';

export interface FlatReviewImage {
  imageUrl: string;
  reviewId: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
}

@Component({
  selector: 'app-reviews-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews-lightbox.html',
  styleUrl: './reviews-lightbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsLightbox implements OnChanges {
  @Input() isOpen = false;
  @Input() reviews: ReviewDto[] = [];
  @Input() startReviewId = '';
  @Input() startImageIndex = 0;

  @Output() closed = new EventEmitter<void>();

  images: FlatReviewImage[] = [];
  currentIndex = 0;

  private touchStartX = 0;
  private touchStartY = 0;
  private touchHandled = false;
  private savedScrollY = 0;

  private cdr = inject(ChangeDetectorRef);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reviews'] || changes['isOpen']) {
      this.rebuildFlatList();
    }
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.jumpToStart();
        this.lockScroll();
      } else {
        this.unlockScroll();
      }
    }
  }

  private rebuildFlatList(): void {
    const flat: FlatReviewImage[] = [];
    for (const r of this.reviews) {
      const imgs = r.images ?? [];
      if (imgs.length === 0) continue;
      const name = `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim() || 'Korisnik';
      for (const img of imgs) {
        flat.push({
          imageUrl: img.imageUrl,
          reviewId: r.id,
          reviewerName: name,
          rating: r.rating,
          comment: r.comment,
        });
      }
    }
    this.images = flat;
  }

  private jumpToStart(): void {
    if (this.images.length === 0) {
      this.currentIndex = 0;
      return;
    }
    const idx = this.images.findIndex(i =>
      i.reviewId === this.startReviewId && this.startImageIndexMatches(i)
    );
    this.currentIndex = idx >= 0 ? idx : 0;
  }

  private startImageIndexMatches(img: FlatReviewImage): boolean {
    let count = 0;
    for (const candidate of this.images) {
      if (candidate.reviewId !== img.reviewId) continue;
      if (count === this.startImageIndex && candidate === img) return true;
      count++;
    }
    return false;
  }

  get current(): FlatReviewImage | null {
    return this.images[this.currentIndex] ?? null;
  }

  next(): void {
    if (this.images.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.cdr.markForCheck();
  }

  prev(): void {
    if (this.images.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.cdr.markForCheck();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('rev-lightbox__backdrop')) {
      this.close();
    }
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchHandled = false;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.touchHandled) return;
    const dx = event.changedTouches[0].clientX - this.touchStartX;
    const dy = event.changedTouches[0].clientY - this.touchStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    this.touchHandled = true;
    if (dx < 0) this.next();
    else this.prev();
    setTimeout(() => { this.touchHandled = false; }, 300);
  }

  private lockScroll(): void {
    if (document.body.style.position === 'fixed') return;
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (document.body.style.position !== 'fixed') return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.savedScrollY, behavior: 'instant' as ScrollBehavior });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.isOpen) this.close(); }

  @HostListener('document:keydown.arrowLeft')
  onArrowLeft(): void { if (this.isOpen) this.prev(); }

  @HostListener('document:keydown.arrowRight')
  onArrowRight(): void { if (this.isOpen) this.next(); }
}
