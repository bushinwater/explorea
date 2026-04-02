import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewCard } from '../../../shared/components/review-card/review-card';
import { ReviewDto } from '../../../core/models/home.model';

@Component({
  selector: 'app-travel-reviews',
  standalone: true,
  imports: [CommonModule, ReviewCard],
  templateUrl: './travel-reviews.html',
  styleUrl: './travel-reviews.css',
})
export class TravelReviews {
  @Input() reviews: ReviewDto[] = [];
}
