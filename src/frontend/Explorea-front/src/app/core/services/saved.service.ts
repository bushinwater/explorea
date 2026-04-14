import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SavedService {
  private api = '/api/saved';

  constructor(private http: HttpClient) {}

  check(entityType: string, entityId: string): Observable<{ isSaved: boolean }> {
    return this.http.get<{ isSaved: boolean }>(`${this.api}/check`, {
      params: { entityType, entityId },
    });
  }

  save(entityType: string, entityId: string): Observable<void> {
    return this.http.post<void>(this.api, { entityType, entityId });
  }

  unsave(entityType: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${entityType}/${entityId}`);
  }
}
