import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AdminReservation, Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = 'http://localhost:5234/api/reservations';

  constructor(private http: HttpClient) {}

  // GET /api/reservations/moje - korisnik vidi svoje rezervacije
  getMoje() {
    return this.http.get<Reservation[]>(`${this.apiUrl}/moje`);
  }

  // POST /api/reservations/5 - korisnik rezerviše knjigu sa ID 5
  rezervisi(knjigaId: number) {
    return this.http.post(`${this.apiUrl}/${knjigaId}`, {});
  }

  // PUT /api/reservations/5/cancel - korisnik otkazuje rezervaciju
  otkaziRezervaciju(id: number) {
    return this.http.put(`${this.apiUrl}/${id}/cancel`, {});
  }

  // GET /api/reservations - admin vidi sve rezervacije
  getAll() {
    return this.http.get<AdminReservation[]>(this.apiUrl);
  }

  // PUT /api/reservations/5/approve - admin odobrava rezervaciju
  odobri(id: number) {
    return this.http.put(`${this.apiUrl}/${id}/approve`, {});
  }

  // PUT /api/reservations/5/return - admin evidentira povratak
  evidentirajPovratak(id: number) {
    return this.http.put(`${this.apiUrl}/${id}/return`, {});
  }
}