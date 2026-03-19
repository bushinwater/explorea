import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Event } from '../../models/event.model';
import { SearchBarComponent } from '../../components/searchbar/searchbar';
import { EventsService } from '../../services/event.service';

@Component({
  selector: 'app-deleted-events-page',
  standalone: true,
  imports: [CommonModule, DatePipe, SearchBarComponent],
  templateUrl: './deleted-events-page.html',
  styleUrl: './deleted-events-page.css',
})
export class DEPComponent implements OnInit {
  private eventsService = inject(EventsService);

  deletedEvents: Event[] = [];
  filteredDeletedEvents: Event[] = [];
  loading = true;
  error = '';
  searchTerm = '';

  ngOnInit(): void {
    this.loadDeletedEvents();
  }

  loadDeletedEvents(): void {
    this.loading = true;
    this.error = '';

    this.eventsService.getDeletedEvents().subscribe({
      next: (data) => {
        this.deletedEvents = data;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = 'Greska u getDeletedEvents()...';
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
      this.filteredDeletedEvents = this.deletedEvents;
      return;
    }

    this.filteredDeletedEvents = this.deletedEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(term) ||
        (event.description?.toLowerCase().includes(term) ?? false) ||
        (event.location?.toLowerCase().includes(term) ?? false),
    );
  }

  restoreEvent(id: number): void {
    this.eventsService.restoreEvent(id).subscribe({
      next: () => {
        this.loadDeletedEvents();
      },
      error: () => {
        alert('Greska restoreEvent()...');
      },
    });
  }

  cleanupDeletedEvents(): void {
    const confirmed = confirm('Da li zelis trajno da obrises sve dogadjaje iz istorije brisanja?');

    if (!confirmed) return;

    this.eventsService.cleanupDeletedEvents().subscribe({
      next: () => {
        this.loadDeletedEvents();
      },
      error: () => {
        alert('Greska pri ciscenju obrisanih eventova.');
      },
    });
  }
}
