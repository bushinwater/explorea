import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { StarRating } from '../star-rating/star-rating';
import { ReviewDto } from '../../../core/models/home.model';
import { ReviewService } from '../../../core/services/review.service';

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StarRating],
  templateUrl: './review-card.html',
  styleUrl: './review-card.css',
})
export class ReviewCard {
  @Input() review!: ReviewDto;
  @Input() currentUserId = '';

  @Output() deleted = new EventEmitter<string>();
  @Output() updated = new EventEmitter<ReviewDto>();

  editMode = false;
  confirmingDelete = false;
  editRating = 0;
  editHover = 0;
  editComment = '';
  saving = false;
  deleting = false;
  editError = '';

  private reviewService = inject(ReviewService);
  private cdr = inject(ChangeDetectorRef);

  imgError = false;

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
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editMode = false;
  }

  saveEdit(): void {
    if (this.editRating === 0 || this.saving) return;
    this.saving = true;
    this.editError = '';
    this.reviewService.update(this.review.id, {
      rating: this.editRating,
      comment: this.editComment.trim() || undefined,
    }).subscribe({
      next: (updated) => {
        this.review = { ...this.review, rating: updated.rating, comment: updated.comment };
        this.saving = false;
        this.editMode = false;
        this.updated.emit(this.review);
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.editError = 'Greška pri čuvanju. Pokušaj ponovo.';
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
}
