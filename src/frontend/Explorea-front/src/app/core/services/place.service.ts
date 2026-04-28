import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PlaceCard, PlaceDetail } from '../models/place.model';

@Injectable({ providedIn: 'root' })
export class PlaceService {
  private readonly api = '/api/places';

  constructor(private http: HttpClient) {}

  getBySlug(slug: string): Observable<PlaceDetail> {
    return this.http.get<PlaceDetail>(`${this.api}/${slug}`);
  }

  getAll(params?: { cityId?: number; typeId?: number; page?: number; pageSize?: number }): Observable<PlaceCard[]> {
    return this.http.get<PlaceCard[]>(this.api, { params: params as any });
  }
}
