import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewCard } from '../review-card/review-card';
import { ReviewDto } from '../../../core/models/home.model';

export interface ReviewPanelItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
    travelerRank?: string;
  };
}

@Component({
  selector: 'app-reviews-panel',
  standalone: true,
  imports: [CommonModule, ReviewCard],
  templateUrl: './reviews-panel.html',
  styleUrl: './reviews-panel.css',
})
export class ReviewsPanel {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() avgRating = 0;
  @Input() reviews: ReviewPanelItem[] = [];
  @Input() currentUserId = '';

  @Output() closed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();
  @Output() updated = new EventEmitter<ReviewDto>();

  asDto(r: ReviewPanelItem): ReviewDto {
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? '',
      createdAt: r.createdAt,
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        travelerRank: r.user.travelerRank ?? '',
        profileImageUrl: r.user.profileImageUrl,
      },
    };
  }

  get starsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
