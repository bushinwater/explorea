import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  getHomeData(): Observable<HomeData> {
    return this.http.get<HomeData>(this.api);
  }

  getCityFilters(): CityFilter[] {
    return CITY_FILTERS;
  }

  getRecommendations(): Observable<DestinationCard[]> {
    return this.http.get<DestinationCard[]>(`${this.api}/recommendations`);
  }
}
