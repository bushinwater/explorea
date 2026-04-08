import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ActivityDetail } from '../../../core/models/activity.model';

@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './booking-card.html',
  styleUrl: './booking-card.css',
})
export class BookingCardComponent {
  @Input() activity!: ActivityDetail;

  persons = 1;

  increment(): void {
    this.persons++;
  }

  decrement(): void {
    if (this.persons > 1) this.persons--;
  }
}
