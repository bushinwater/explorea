import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminProfile } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminProfileService {
  private readonly http = inject(HttpClient);

  readonly profile = signal<AdminProfile | null>(null);

  load(): Observable<AdminProfile> {
    return this.http.get<AdminProfile>('/api/admin/me').pipe(
      tap(p => this.profile.set(p)),
    );
  }
}
