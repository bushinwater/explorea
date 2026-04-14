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

  lightboxOpen = false;
  lightboxIndex = 0;
  showAll = false;

  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
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
