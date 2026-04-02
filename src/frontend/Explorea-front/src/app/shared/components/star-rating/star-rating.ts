import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.html',
  styleUrl: './star-rating.css',
})
export class StarRating {
  @Input() rating: number = 0;
  @Input() showValue: boolean = true;

  get stars(): ('full' | 'half' | 'empty')[] {
    const result: ('full' | 'half' | 'empty')[] = [];
    for (let i = 1; i <= 5; i++) {
      if (this.rating >= i) {
        result.push('full');
      } else if (this.rating >= i - 0.5) {
        result.push('half');
      } else {
        result.push('empty');
      }
    }
    return result;
  }
}
