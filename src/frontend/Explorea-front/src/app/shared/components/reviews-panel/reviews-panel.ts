import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ReviewPanelItem {
  rating: number;
  comment?: string | null;
  user: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
    travelerRank?: string;
  };
}

@Component({
  selector: 'app-reviews-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews-panel.html',
  styleUrl: './reviews-panel.css',
})
export class ReviewsPanel {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() avgRating = 0;
  @Input() reviews: ReviewPanelItem[] = [];
  @Output() closed = new EventEmitter<void>();

  get starsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
