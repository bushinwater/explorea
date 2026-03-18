import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Event } from '../../services/event';
import { Registration } from '../../services/registration';
import { EventModel } from '../../models/event.model';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-events',
  imports: [CommonModule],
  templateUrl: './events.html',
  styleUrl: './events.scss'
})
export class Events implements OnInit {
  private eventService = inject(Event);
  private registrationService = inject(Registration);

  authService = inject(Auth);

  events: EventModel[] = [];
  errorMessage = '';
  successMessage = '';

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

  registerForEvent(eventId: number): void {
    this.successMessage = '';
    this.errorMessage = '';

    this.registrationService.registerForEvent(eventId).subscribe({
      next: (response) => {
        this.successMessage = response.message || 'Uspešna prijava na događaj.';
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Greška pri prijavi na događaj.';
      }
    });
  }
}