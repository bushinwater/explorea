import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnDestroy, SimpleChanges,
  HostListener, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReviewService } from '../../../core/services/review.service';
import { ReviewDto } from '../../../core/models/home.model';

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

  rating = 0;
  hoverRating = 0;
  comment = '';
  error = '';
  submitting = false;

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

  submit(): void {
    if (!this.entityId || this.rating === 0 || this.submitting) return;
    this.submitting = true;
    this.error = '';

    this.reviewService.create({
      entityType: this.entityType,
      entityId: this.entityId,
      rating: this.rating,
      comment: this.comment || undefined,
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
