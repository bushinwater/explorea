import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminProfile } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminProfileService {
  private readonly http = inject(HttpClient);

  readonly profile = signal<AdminProfile | null>(null);
  readonly isPhotoUploading = signal(false);

  load(): Observable<AdminProfile> {
    return this.http.get<AdminProfile>('/api/admin/me').pipe(
      tap(p => this.profile.set(p)),
    );
  }

  patch(partial: Partial<Pick<AdminProfile, 'firstName' | 'lastName' | 'profileImageUrl'>>): void {
    const current = this.profile();
    if (current) this.profile.set({ ...current, ...partial });
  }
}
