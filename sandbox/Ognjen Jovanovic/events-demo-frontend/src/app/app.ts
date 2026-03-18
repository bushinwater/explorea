import { Component, OnInit, inject } from '@angular/core';
import { CreateEventRequest, EventsService } from './services/event.service';
import { Event } from './models/event.model';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private eventsService = inject(EventsService);
  events: Event[] = [];
  loading = true;
  error = '';

  isEditMode = false;
  editingEventId: number | null = null;

  formData: CreateEventRequest = {
    title: '',
    description: '',
    eventDate: '',
    location: '',
    isCompleted: false,
  };

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.eventsService.getEvents().subscribe({
      next: (data) => {
        this.events = data;
        this.loading = false;
      },

      error: () => {
        this.error = 'Greska pri ucitavanju dogadjaja.';
        this.loading = false;
      },
    });
  }

  resetForm(): void {
    this.formData = {
      title: '',
      description: '',
      eventDate: '',
      location: '',
      isCompleted: false,
    };
    this.isEditMode = false;
    this.editingEventId = null;
  }

  createEvent(): void {
    if (!this.formData.title.trim() || !this.formData.eventDate) {
      alert('Title i datum su obavezni');
      return;
    }

    this.eventsService.createEvent(this.formData).subscribe({
      next: () => {
        this.formData = {
          title: '',
          description: '',
          eventDate: '',
          location: '',
          isCompleted: false,
        };
        this.loadEvents();
      },
      error: (err) => {
        console.log(err);
        alert('Greska pri kreiranju event-a.');
      },
    });
  }

  startEdit(event: Event): void {
    this.isEditMode = true;
    this.editingEventId = event.id;

    this.formData = {
      title: event.title,
      description: event.description ?? '',
      eventDate: this.toDateTimeLocalValue(event.eventDate),
      location: event.location ?? '',
      isCompleted: event.isCompleted,
    };
  }

  updateEvent(): void {
    if (this.editingEventId === null) return;

    const existingEvent = this.events.find((e) => e.id === this.editingEventId);
    if (!existingEvent) return;

    const payload: Event = {
      id: existingEvent.id,
      title: this.formData.title,
      description: this.formData.description,
      eventDate: this.formData.eventDate,
      location: this.formData.location,
      isCompleted: this.formData.isCompleted,
      created: existingEvent.created,
      updated: existingEvent.updated,
    };

    this.eventsService.updateEvent(this.editingEventId, payload).subscribe({
      next: () => {
        this.resetForm();
        this.loadEvents();
      },
      error: (err) => {
        console.error('UPDATE ERROR:', err);
        alert('Greska pri izmeni event-a.');
      },
    });
  }

  submitForm(): void {
    if (this.isEditMode) {
      this.updateEvent();
    } else {
      this.createEvent();
    }
  }

  deleteEvent(id: number): void {
    const confirmed = confirm('Je l stvarno hoces da obrises event?');

    if (!confirmed) return;

    this.eventsService.deleteEvent(id).subscribe({
      next: () => {
        if (this.editingEventId === id) {
          this.resetForm();
        }
        this.loadEvents();
      },
      error: () => {
        alert('Greska pri brisanju event-a.');
      },
    });
  }

  private toDateTimeLocalValue(dateString: string): string {
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  }
}
