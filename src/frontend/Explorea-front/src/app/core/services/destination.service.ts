import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DestinationCard, DestinationDetail } from '../models/destination.model';

@Injectable({
  providedIn: 'root'
})
export class DestinationService {
  private http = inject(HttpClient);
  private apiUrl = '/api/destinations';

  getAllDestinations(): Observable<DestinationCard[]> {
    return this.http.get<DestinationCard[]>(this.apiUrl);
  }

  getDestinationBySlug(slug: string): Observable<DestinationDetail> {
    return this.http.get<DestinationDetail>(`${this.apiUrl}/${slug}`);
  }
}