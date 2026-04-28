import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BugReportService {
  private http = inject(HttpClient);

  submit(dto: { subject: string; description: string; email?: string }): Observable<void> {
    return this.http.post<void>('/api/bug-reports', dto);
  }
}
