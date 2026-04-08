import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SearchResult } from '../models/search.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = '/api/search';

  constructor(private http: HttpClient) {}

  search(q: string, limit = 8): Observable<SearchResult> {
    return this.http.get<SearchResult>(this.api, { params: { q, limit } });
  }
}
