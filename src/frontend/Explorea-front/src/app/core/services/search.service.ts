import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SearchResult } from '../models/search.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = '/api/search';

  constructor(private http: HttpClient) {}

  search(q: string, limit = 8, userLat?: number, userLng?: number, radiusKm?: number): Observable<SearchResult> {
    let params: Record<string, any> = { q, limit };
    if (userLat != null && userLng != null) {
      params['userLat'] = userLat;
      params['userLng'] = userLng;
      if (radiusKm != null) params['radiusKm'] = radiusKm;
    }
    return this.http.get<SearchResult>(this.api, { params });
  }
}
