import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExpiredPlannerEvent, PlannerDot, PlannerEntry } from '../models/planner.model';

@Injectable({ providedIn: 'root' })
export class PlannerService {
  private readonly base = '/api/planner';

  constructor(private http: HttpClient) {}

  getMonthDots(year: number, month: number): Observable<PlannerDot[]> {
    return this.http.get<PlannerDot[]>(`${this.base}/month`, {
      params: { year: String(year), month: String(month) },
    });
  }

  getDayEntries(date: string): Observable<PlannerEntry[]> {
    return this.http.get<PlannerEntry[]>(`${this.base}/day`, {
      params: { date },
    });
  }

  getExpiredEvents(): Observable<ExpiredPlannerEvent[]> {
    return this.http.get<ExpiredPlannerEvent[]>(`${this.base}/expired-events`);
  }

  addEntry(eventId: string, plannedAt: string, note: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/add`, { eventId, plannedAt, note });
  }

  addGenericEntry(entityType: string, entityId: string, plannedAt: string, note: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/add-entity`, { entityType, entityId, plannedAt, note });
  }

  removeEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/items/${id}`);
  }

  removeAllEntriesForEntity(entityType: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/entity/${entityType}/${entityId}`);
  }
}
