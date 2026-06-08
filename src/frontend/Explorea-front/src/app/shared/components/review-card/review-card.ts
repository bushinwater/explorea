import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { StarRating } from '../star-rating/star-rating';
import { ReviewDto, ReviewImageDto } from '../../../core/models/home.model';
import { ReviewService } from '../../../core/services/review.service';

interface EditDraftImage {
  previewUrl: string;
  uploadedUrl: string;
  isObjectUrl: boolean;
  uploading: boolean;
  error?: string;
}

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const THUMB_LIMIT = 3;

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, StarRating],
  templateUrl: './review-card.html',
  styleUrl: './review-card.css',
})
export class ReviewCard {
  @Input() review!: ReviewDto;
  @Input() currentUserId = '';
  @Input() compact = false;

  @Output() deleted = new EventEmitter<string>();
  @Output() updated = new EventEmitter<ReviewDto>();
  @Output() imageClicked = new EventEmitter<{ reviewId: string; imageIndex: number }>();

  @ViewChild('editFileInput') editFileInput?: ElementRef<HTMLInputElement>;

  editMode = false;
  confirmingDelete = false;
  editRating = 0;
  editHover = 0;
  editComment = '';
  editImages: EditDraftImage[] = [];
  saving = false;
  deleting = false;
  editError = '';

  readonly maxImages = MAX_IMAGES;
  readonly thumbLimit = THUMB_LIMIT;

  private reviewService = inject(ReviewService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  imgError = false;

  onImageClick(index: number): void {
    this.imageClicked.emit({ reviewId: this.review.id, imageIndex: index });
  }

  get reviewImages(): ReviewImageDto[] {
    return this.review.images ?? [];
  }

  get thumbCap(): number {
    return this.compact ? 2 : THUMB_LIMIT;
  }

  get visibleThumbs(): ReviewImageDto[] {
    return this.reviewImages.slice(0, this.thumbCap);
  }

  get extraImagesCount(): number {
    return Math.max(0, this.reviewImages.length - this.thumbCap);
  }

  get isOwner(): boolean {
    return !!this.currentUserId && this.review.user.id === this.currentUserId;
  }

  get showImage(): boolean {
    return !!this.review.user.profileImageUrl && !this.imgError;
  }

  onImgError(): void {
    this.imgError = true;
  }

  get initials(): string {
    const f = this.review.user.firstName?.[0] ?? '';
    const l = this.review.user.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  get rankIcon(): string {
    const rank = this.review.user.travelerRank.toLowerCase();
    if (rank.includes('zlatni')) return 'workspace_premium';
    if (rank.includes('srebrni')) return 'military_tech';
    return 'emoji_events';
  }

  get entityRoute(): string[] | null {
    if (!this.review.entitySlug || !this.review.entityType) return null;
    const map: Record<string, string> = {
      activity: '/activities',
      destination: '/destinations',
      place: '/places',
      event: '/events',
    };
    const base = map[this.review.entityType];
    return base ? [base, this.review.entitySlug] : null;
  }

  startEdit(): void {
    this.editRating = this.review.rating;
    this.editComment = this.review.comment ?? '';
    this.editError = '';
    this.revokeEditObjectUrls();
    this.editImages = (this.reviewImages).map(img => ({
      previewUrl: img.imageUrl,
      uploadedUrl: img.imageUrl,
      isObjectUrl: false,
      uploading: false,
    }));
    this.editMode = true;
  }

  cancelEdit(): void {
    this.revokeEditObjectUrls();
    this.editImages = [];
    this.editMode = false;
  }

  private revokeEditObjectUrls(): void {
    for (const img of this.editImages) {
      if (img.isObjectUrl) {
        try { URL.revokeObjectURL(img.previewUrl); } catch { /* ignore */ }
      }
    }
  }

  triggerEditFilePicker(): void {
    this.editFileInput?.nativeElement.click();
  }

  onEditFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.addEditFiles(Array.from(input.files));
    input.value = '';
  }

  private addEditFiles(files: File[]): void {
    this.editError = '';
    const slotsLeft = MAX_IMAGES - this.editImages.length;
    if (slotsLeft <= 0) {
      this.editError = this.translate.instant('REVIEW_MODAL.IMAGES_MAX_REACHED', { max: MAX_IMAGES });
      this.cdr.detectChanges();
      return;
    }

    const incoming = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      this.editError = this.translate.instant('REVIEW_MODAL.IMAGES_MAX_REACHED', { max: MAX_IMAGES });
    }

    for (const file of incoming) {
      const type = (file.type || '').toLowerCase();
      if (!ACCEPTED_TYPES.includes(type)) {
        this.editError = this.translate.instant('REVIEW_MODAL.IMAGE_INVALID_TYPE', { name: file.name });
        continue;
      }
      if (file.size > MAX_BYTES) {
        this.editError = this.translate.instant('REVIEW_MODAL.IMAGE_TOO_LARGE', { name: file.name });
        continue;
      }
      const draft: EditDraftImage = {
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: '',
        isObjectUrl: true,
        uploading: true,
      };
      this.editImages.push(draft);
      this.uploadEditFile(file, draft);
    }
    this.cdr.detectChanges();
  }

  private uploadEditFile(file: File, draft: EditDraftImage): void {
    this.reviewService.uploadImages([file]).subscribe({
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

  removeEditImage(index: number): void {
    const removed = this.editImages.splice(index, 1)[0];
    if (removed && removed.isObjectUrl) {
      try { URL.revokeObjectURL(removed.previewUrl); } catch { /* ignore */ }
    }
    this.cdr.detectChanges();
  }

  get editHasUploads(): boolean {
    return this.editImages.some(i => i.uploading);
  }

  get canSaveEdit(): boolean {
    return this.editRating > 0 && !this.saving && !this.editHasUploads;
  }

  saveEdit(): void {
    if (!this.canSaveEdit) return;
    this.saving = true;
    this.editError = '';

    const imageUrls = this.editImages
      .filter(i => !!i.uploadedUrl)
      .map(i => i.uploadedUrl);

    this.reviewService.update(this.review.id, {
      rating: this.editRating,
      comment: this.editComment.trim() || undefined,
      imageUrls,
    }).subscribe({
      next: (updated) => {
        this.review = {
          ...this.review,
          rating: updated.rating,
          comment: updated.comment,
          images: updated.images ?? [],
        };
        this.revokeEditObjectUrls();
        this.editImages = [];
        this.saving = false;
        this.editMode = false;
        this.updated.emit(this.review);
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.editError = this.translate.instant('COMMON.SAVE_ERROR');
        this.cdr.detectChanges();
      },
    });
  }

  onDelete(): void {
    if (!this.confirmingDelete) {
      this.confirmingDelete = true;
      this.cdr.detectChanges();
      return;
    }
    if (this.deleting) return;
    this.deleting = true;
    this.confirmingDelete = false;
    this.reviewService.delete(this.review.id).subscribe({
      next: () => {
        this.deleted.emit(this.review.id);
      },
      error: () => {
        this.deleting = false;
        this.cdr.detectChanges();
      },
    });
  }

  cancelDelete(): void {
    this.confirmingDelete = false;
    this.cdr.detectChanges();
  }

  getStars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  formatDate(isoDate: string | null | undefined): string {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleDateString('sr-Latn', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
