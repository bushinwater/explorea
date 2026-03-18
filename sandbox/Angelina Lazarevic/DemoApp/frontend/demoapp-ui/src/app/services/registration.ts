import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegistrationModel } from '../models/registration.model';

@Injectable({
  providedIn: 'root'
})
export class Registration {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5041/api/Registrations';

  registerForEvent(eventId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${eventId}`, {});
  }

  getMyRegistrations(): Observable<RegistrationModel[]> {
    return this.http.get<RegistrationModel[]>(`${this.apiUrl}/my`);
  }

  getAllRegistrations(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}