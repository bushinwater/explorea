import { Component, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GalleryImage {
  imageUrl: string;
  caption: string | null;
}

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-gallery.html',
  styleUrl: './image-gallery.css',
})
export class ImageGallery {
  @Input() images: GalleryImage[] = [];
  @Input() viewAllLabel = 'Vidi sve';
  /** When > 0, only this many thumbnails are shown; "Vidi sve" opens the lightbox. */
  @Input() maxPreview = 0;
  /** When true, shows a 3-image grid on desktop (1 large + 2 small), horizontal scroll on mobile. */
  @Input() gridLayout = false;

  lightboxOpen = false;
  lightboxIndex = 0;
  showAll = false;

  get visibleImages(): GalleryImage[] {
    return this.maxPreview > 0 ? this.images.slice(0, this.maxPreview) : this.images;
  }

  get hasHidden(): boolean {
    return this.maxPreview > 0 && this.images.length > this.maxPreview;
  }

  get gridImages(): GalleryImage[] {
    return this.images.slice(0, 3);
  }

  get hasHiddenGrid(): boolean {
    return this.images.length > 3;
  }

  get showViewAll(): boolean {
    if (this.gridLayout) return this.hasHiddenGrid;
    if (this.maxPreview > 0) return this.hasHidden;
    return true;
  }

  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  onViewAll(): void {
    if (this.maxPreview > 0) {
      this.openLightbox(0);
    } else {
      this.showAll = !this.showAll;
    }
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  prev(): void {
    this.lightboxIndex = (this.lightboxIndex - 1 + this.images.length) % this.images.length;
  }

  next(): void {
    this.lightboxIndex = (this.lightboxIndex + 1) % this.images.length;
  }

  get currentImage(): GalleryImage {
    return this.images[this.lightboxIndex];
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) this.closeLightbox();
  }

  @HostListener('document:keydown.arrowLeft')
  onLeft(): void {
    if (this.lightboxOpen) this.prev();
  }

  @HostListener('document:keydown.arrowRight')
  onRight(): void {
    if (this.lightboxOpen) this.next();
  }
}
