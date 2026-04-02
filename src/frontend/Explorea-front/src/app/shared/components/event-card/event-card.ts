import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventCard as EventCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-card.html',
  styleUrl: './event-card.css',
})
export class EventCard {
  @Input() event!: EventCardModel;

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
