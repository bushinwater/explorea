import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  HomeData,
  DestinationCard,
  CityFilter,
} from '../models/home.model';

export const CITY_FILTERS: CityFilter[] = [
  { id: null, name: 'Popularne' },
  { id: 1, name: 'Beograd' },
  { id: 2, name: 'Novi Sad' },
  { id: 3, name: 'Niš' },
  { id: 4, name: 'Kopaonik' },
  { id: 5, name: 'Zlatibor' },
  { id: 6, name: 'Subotica' },
];

@Injectable({ providedIn: 'root' })
export class HomeService {
  private api = '/api/home';

  constructor(private http: HttpClient) {}

  getHomeData(cityId?: number | null): Observable<HomeData> {
    let params = new HttpParams();
    if (cityId != null) params = params.set('cityId', cityId);
    return this.http.get<HomeData>(this.api, { params });
  }

  getCityFilters(): CityFilter[] {
    return CITY_FILTERS;
  }

  getRecommendations(userLat?: number, userLng?: number): Observable<any> {
    let params = new HttpParams();
    if (userLat != null) params = params.set('userLat', userLat);
    if (userLng != null) params = params.set('userLng', userLng);
    return this.http.get<any>(`${this.api}/recommendations`, { params });
  }
}
