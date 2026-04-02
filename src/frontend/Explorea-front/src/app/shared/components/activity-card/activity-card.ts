import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StarRating } from '../star-rating/star-rating';
import { ActivityCard as ActivityCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [CommonModule, StarRating],
  templateUrl: './activity-card.html',
  styleUrl: './activity-card.css',
})
export class ActivityCard {
  @Input() activity!: ActivityCardModel;

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
}
