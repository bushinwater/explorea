import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnDestroy, SimpleChanges,
  HostListener, inject, ChangeDetectorRef, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReviewService } from '../../../core/services/review.service';
import { ReviewDto } from '../../../core/models/home.model';

interface DraftImage {
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
  uploading: boolean;
  error?: string;
}

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

@Component({
  selector: 'app-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './review-modal.html',
  styleUrl: './review-modal.css',
})
export class ReviewModal implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() entityType = '';
  @Input() entityId = '';
  @Input() entityName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() reviewSubmitted = new EventEmitter<ReviewDto>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput?: ElementRef<HTMLInputElement>;

  sourcePickerOpen = false;
  isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  rating = 0;
  hoverRating = 0;
  comment = '';
  error = '';
  submitting = false;
  images: DraftImage[] = [];

  readonly maxImages = MAX_IMAGES;

  private savedScrollY = 0;

  private reviewService = inject(ReviewService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.rating = 0;
        this.hoverRating = 0;
        this.comment = '';
        this.error = '';
        this.submitting = false;
        this.revokeAllPreviews();
        this.images = [];
        this.savedScrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.savedScrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
      } else {
        this.unlockScroll();
      }
    }
  }

  ngOnDestroy(): void {
    this.unlockScroll();
    this.revokeAllPreviews();
  }

  private revokeAllPreviews(): void {
    for (const img of this.images) {
      try { URL.revokeObjectURL(img.previewUrl); } catch { /* ignore */ }
    }
  }

  private unlockScroll(): void {
    if (document.body.style.position === 'fixed') {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo({ top: this.savedScrollY, behavior: 'instant' as ScrollBehavior });
    }
  }

  close(): void {
    this.closed.emit();
  }

  triggerFilePicker(): void {
    // On touch devices, prompt the user to choose between camera and library.
    if (this.isTouchDevice) {
      this.sourcePickerOpen = true;
      return;
    }
    this.fileInput?.nativeElement.click();
  }

  pickFromCamera(): void {
    this.sourcePickerOpen = false;
    this.cameraInput?.nativeElement.click();
  }

  pickFromLibrary(): void {
    this.sourcePickerOpen = false;
    this.fileInput?.nativeElement.click();
  }

  closeSourcePicker(): void {
    this.sourcePickerOpen = false;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  private addFiles(files: File[]): void {
    this.error = '';
    const slotsLeft = MAX_IMAGES - this.images.length;
    if (slotsLeft <= 0) {
      this.error = this.translate.instant('REVIEW_MODAL.IMAGES_MAX_REACHED', { max: MAX_IMAGES });
      this.cdr.detectChanges();
      return;
    }

    const incoming = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      this.error = this.translate.instant('REVIEW_MODAL.IMAGES_MAX_REACHED', { max: MAX_IMAGES });
    }

    for (const file of incoming) {
      const type = (file.type || '').toLowerCase();
      if (!ACCEPTED_TYPES.includes(type)) {
        this.error = this.translate.instant('REVIEW_MODAL.IMAGE_INVALID_TYPE', { name: file.name });
        continue;
      }
      if (file.size > MAX_BYTES) {
        this.error = this.translate.instant('REVIEW_MODAL.IMAGE_TOO_LARGE', { name: file.name });
        continue;
      }
      const draft: DraftImage = {
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: true,
      };
      this.images.push(draft);
      this.uploadSingle(draft);
    }
    this.cdr.detectChanges();
  }

  private uploadSingle(draft: DraftImage): void {
    this.reviewService.uploadImages([draft.file]).subscribe({
      next: (res) => {
        draft.uploadedUrl = res.urls[0];
        draft.uploading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        draft.uploading = false;
        draft.error = this.translate.instant('REVIEW_MODAL.IMAGE_UPLOAD_FAILED');
        this.cdr.detectChanges();
      },
    });
  }

  removeImage(index: number): void {
    const removed = this.images.splice(index, 1)[0];
    if (removed) {
      try { URL.revokeObjectURL(removed.previewUrl); } catch { /* ignore */ }
    }
    this.cdr.detectChanges();
  }

  get hasUploads(): boolean {
    return this.images.some(i => i.uploading);
  }

  get canSubmit(): boolean {
    return this.rating > 0 && !this.submitting && !this.hasUploads;
  }

  submit(): void {
    if (!this.entityId || !this.canSubmit) return;
    this.submitting = true;
    this.error = '';

    const imageUrls = this.images
      .filter(i => !!i.uploadedUrl)
      .map(i => i.uploadedUrl!) as string[];

    this.reviewService.create({
      entityType: this.entityType,
      entityId: this.entityId,
      rating: this.rating,
      comment: this.comment || undefined,
      imageUrls,
    }).subscribe({
      next: (review) => {
        this.submitting = false;
        this.reviewSubmitted.emit(review);
        this.closed.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.status === 409
          ? this.translate.instant('REVIEW_MODAL.ERROR_ALREADY')
          : this.translate.instant('COMMON.ERROR_GENERIC');
        this.cdr.detectChanges();
      },
    });
  }

  getStarsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.close();
  }
}
