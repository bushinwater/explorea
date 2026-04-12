import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StarRating } from '../star-rating/star-rating';
import { ReviewDto } from '../../../core/models/home.model';

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule, RouterModule, StarRating],
  templateUrl: './review-card.html',
  styleUrl: './review-card.css',
})
export class ReviewCard {
  @Input() review!: ReviewDto;

  get initials(): string {
    return (
      this.review.user.firstName[0] + this.review.user.lastName[0]
    ).toUpperCase();
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
}
