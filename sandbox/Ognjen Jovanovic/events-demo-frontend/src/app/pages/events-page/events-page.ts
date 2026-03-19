import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Event } from '../../models/event.model';
import { EventsService } from '../../services/event.service';
import { SearchBarComponent } from '../../components/searchbar/searchbar';
@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, DatePipe, SearchBarComponent],
  templateUrl: './events-page.html',
  styleUrl: './events-page.css',
})
export class EventsPageComponent implements OnInit {
  private eventsService = inject(EventsService);
  private router = inject(Router);

  events: Event[] = [];
  filteredEvents: Event[] = [];
  loading = true;
  error = '';
  searchTerm = '';

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.eventsService.getEvents().subscribe({
      next: (data) => {
        this.events = data;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = 'Ne valja ucitavanje dogadjaja';
        this.loading = false;
      },
    });
  }

  onSearchChanged(term: string): void {
    this.searchTerm = term;
    this.applyFilter();
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredEvents = this.events;
      return;
    }

    this.filteredEvents = this.events.filter(
      (event) =>
        event.title.toLowerCase().includes(term) ||
        (event.description?.toLocaleLowerCase().includes(term) ?? false) ||
        (event.location?.toLowerCase().includes(term) ?? false),
    );
  }

  goToCreatePage(): void {
    this.router.navigate(['/events/new']);
  }

  goToEditPage(id: number): void {
    this.router.navigate(['/events/edit', id]);
  }

  deleteEvent(id: number): void {
    const confirmed = confirm('Ces stvarno da brises dogadjaj?');
    if (!confirmed) return;

    this.eventsService.deleteEvent(id).subscribe({
      next: () => {
        this.loadEvents();
      },
      error: () => {
        alert('Greska pri brisanju dogadjaj');
      },
    });
  }

  private toDatetimeLocalValue(dateString: string): string {
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  }
}
