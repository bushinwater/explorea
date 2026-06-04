import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EventCard as EventCardModel } from '../../../core/models/home.model';
import { PlannerEventRef } from '../../../core/models/planner.model';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './event-card.html',
  styleUrl: './event-card.css',
})
export class EventCard {
  @Input() event!: EventCardModel;
  @Input() listMode  = false;
  @Input() fullWidth = false;
  @Input() showPlannerBtn = false;
  @Output() plannerClick = new EventEmitter<PlannerEventRef>();

  onPlannerClick(e: MouseEvent): void {
    e.stopPropagation();
    e.preventDefault();
    this.plannerClick.emit({
      id:            this.event.id,
      name:          this.event.name,
      startDatetime: this.event.startDatetime,
      endDatetime:   this.event.endDatetime,
    });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatDateRange(start: string, end: string): string {
    const s = new Date(start);
    const e = end ? new Date(end) : s;
    const same = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
    if (same) return s.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' });
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
  }

  locationLabel(): string {
    return this.event.address || this.event.city?.name || 'Lokacija nije navedena';
  }
}
