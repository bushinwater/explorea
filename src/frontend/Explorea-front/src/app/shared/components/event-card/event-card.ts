import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventCard as EventCardModel } from '../../../core/models/home.model';
import { PlannerEventRef } from '../../../core/models/planner.model';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
  }
}
