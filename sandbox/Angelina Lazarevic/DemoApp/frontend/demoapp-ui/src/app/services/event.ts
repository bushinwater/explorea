import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EventModel } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class Event {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5041/api/Events';

  getEvents(): Observable<EventModel[]> {
    return this.http.get<EventModel[]>(this.apiUrl);
  }

  createEvent(data: {
    title: string;
    description: string;
    location: string;
    date: string;
    capacity: number;
  }): Observable<EventModel> {
    return this.http.post<EventModel>(this.apiUrl, data);
  }

  updateEvent(id: number, data: {
    title: string;
    description: string;
    location: string;
    date: string;
    capacity: number;
  }): Observable<EventModel> {
    return this.http.put<EventModel>(`${this.apiUrl}/${id}`, data);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}