import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Event } from '../../models/event.model';
import { CreateEventRequest, EventsService } from '../../services/event.service';

@Component({
  selector: 'app-event-form-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form-page.html',
  styleUrl: './event-form-page.css',
})
export class EFPComponent implements OnInit {
  private eventsService = inject(EventsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEditMode = false;
  editingEventId: number | null = null;
  existingEvent: Event | null = null;

  loading = false;
  error = '';

  formData: CreateEventRequest = {
    title: '',
    description: '',
    eventDate: '',
    location: '',
    isCompleted: false,
  };

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      this.isEditMode = true;
      this.editingEventId = Number(idParam);
      this.loadEventForEdit(this.editingEventId);
    }
  }

  loadEventForEdit(id: number): void {
    this.loading = true;
    this.error = '';

    this.eventsService.getEventById(id).subscribe({
      next: (event) => {
        this.existingEvent = event;
        this.formData = {
          title: event.title,
          description: event.description ?? '',
          eventDate: this.toDateTimeLocalValue(event.eventDate),
          location: event.location ?? '',
          isCompleted: event.isCompleted,
        };
        this.loading = false;
      },
      error: () => {
        this.error = 'Greska pri ucitavanju event-a.';
        this.loading = false;
      },
    });
  }

  submitForm(): void {
    if (!this.formData.title.trim() || !this.formData.eventDate) {
      alert('Title i datum su obavezni.');
      return;
    }

    if (this.isEditMode) this.updateEvent();
    else this.createEvent();
  }

  createEvent(): void {
    this.eventsService.createEvent(this.formData).subscribe({
      next: () => {
        this.router.navigate(['/events']);
      },
      error: (err) => {
        console.error('CREATE ERROR:', err);
        alert('Greska pri kreiranju event-a.');
      },
    });
  }

  updateEvent(): void {
    if (this.editingEventId === null || this.existingEvent === null) return;

    const payload: Event = {
      id: this.existingEvent.id,
      title: this.formData.title,
      description: this.formData.description,
      eventDate: this.formData.eventDate,
      location: this.formData.location,
      isCompleted: this.formData.isCompleted,
      created: this.existingEvent.created,
      updated: this.existingEvent.updated,
      isDeleted: this.existingEvent.isDeleted,
      deletedAt: this.existingEvent.deletedAt,
    };

    this.eventsService.updateEvent(this.editingEventId, payload).subscribe({
      next: () => {
        this.router.navigate(['/events']);
      },
      error: (err) => {
        console.error('UPDATE ERROR:', err);
        alert('Greska pri izmeni event-a.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/events']);
  }

  private toDateTimeLocalValue(dateString: string): string {
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  }
}
