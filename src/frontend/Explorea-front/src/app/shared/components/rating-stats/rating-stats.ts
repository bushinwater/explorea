import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-rating-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './rating-stats.html',
  styleUrl: './rating-stats.css',
})
export class RatingStats {
  @Input() avgRating: number = 0;
  @Input() reviews: { rating: number }[] = [];

  get breakdown(): { stars: number; count: number; pct: number }[] {
    const total = this.reviews.length;
    return [5, 4, 3, 2, 1].map(stars => {
      const count = this.reviews.filter(r => r.rating === stars).length;
      return { stars, count, pct: total > 0 ? (count / total) * 100 : 0 };
    });
  }

  get starsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }
}
