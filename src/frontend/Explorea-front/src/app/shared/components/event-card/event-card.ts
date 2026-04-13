import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventCard as EventCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './event-card.html',
  styleUrl: './event-card.css',
})
export class EventCard {
  @Input() event!: EventCardModel;
  @Input() listMode = false;
  @Input() fullWidth = false;

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
  }
}
