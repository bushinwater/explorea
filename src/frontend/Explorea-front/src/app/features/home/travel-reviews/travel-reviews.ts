import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ReviewCard } from '../../../shared/components/review-card/review-card';
import { ReviewsLightbox } from '../../../shared/components/reviews-lightbox/reviews-lightbox';
import { ReviewDto } from '../../../core/models/home.model';

@Component({
  selector: 'app-travel-reviews',
  standalone: true,
  imports: [CommonModule, TranslateModule, ReviewCard, ReviewsLightbox],
  templateUrl: './travel-reviews.html',
  styleUrl: './travel-reviews.css',
})
export class TravelReviews {
  @Input() reviews: ReviewDto[] = [];

  lightboxOpen = false;
  startReviewId = '';
  startImageIndex = 0;

  private cdr = inject(ChangeDetectorRef);

  openLightbox(payload: { reviewId: string; imageIndex: number }): void {
    this.startReviewId = payload.reviewId;
    this.startImageIndex = payload.imageIndex;
    this.lightboxOpen = true;
    this.cdr.detectChanges();
  }
}
