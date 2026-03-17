import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Event } from '../models/event.model';

export interface CreateEventRequest {
  title: string;
  description?: string;
  eventDate: string;
  location?: string;
  isCompleted: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class EventsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5080/api/events';

  getEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(this.apiUrl);
  }

  createEvent(payload: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.apiUrl, payload);
  }

  updateEvent(id: number, payload: Event): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, payload);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
