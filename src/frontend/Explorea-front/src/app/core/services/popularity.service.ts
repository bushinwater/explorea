import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PopularityService {
  private api = '/api/popularity';

  constructor(private http: HttpClient) {}

  track(entityType: string, entityId: string): void {
    this.http.post(`${this.api}/track`, { entityType, entityId }).subscribe();
  }
}
