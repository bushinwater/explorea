import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EventCard } from '../../../shared/components/event-card/event-card';
import { EventCard as EventCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-upcoming-events',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, EventCard],
  templateUrl: './upcoming-events.html',
  styleUrl: './upcoming-events.css',
})
export class UpcomingEvents {
  @Input() events: EventCardModel[] = [];
}
