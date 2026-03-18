import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Event } from '../../services/event';
import { EventModel } from '../../models/event.model';

@Component({
  selector: 'app-admin-events',
  imports: [FormsModule, CommonModule],
  templateUrl: './admin-events.html',
  styleUrl: './admin-events.scss'
})
export class AdminEvents implements OnInit {
  private eventService = inject(Event);

  events: EventModel[] = [];

  title = '';
  description = '';
  location = '';
  date = '';
  capacity: number | null = null;

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.eventService.getEvents().subscribe({
      next: data => {
        this.events = data;
      },
      error: () => {
        this.errorMessage = 'Greška pri učitavanju događaja.';
      }
    });
  }

  createEvent(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.title || !this.description || !this.location || !this.date || this.capacity === null) {
      this.errorMessage = 'Popuni sva polja.';
      return;
    }

    this.eventService.createEvent({
      title: this.title,
      description: this.description,
      location: this.location,
      date: this.date,
      capacity: Number(this.capacity)
    }).subscribe({
      next: () => {
        this.successMessage = 'Događaj uspešno dodat.';
        this.title = '';
        this.description = '';
        this.location = '';
        this.date = '';
        this.capacity = null;
        this.loadEvents();
      },
      error: err => {
        this.errorMessage = err?.error?.message || 'Greška pri dodavanju događaja.';
      }
    });
  }

  deleteEvent(id: number): void {
    this.successMessage = '';
    this.errorMessage = '';

    this.eventService.deleteEvent(id).subscribe({
      next: () => {
        this.successMessage = 'Događaj uspešno obrisan.';
        this.loadEvents();
      },
      error: () => {
        this.errorMessage = 'Greška pri brisanju događaja.';
      }
    });
  }
}