import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

const STORAGE_KEY = 'explorea_selected_interests';

export interface InterestTag {
  id: number;
  name: string;
  icon: string | null;
}

@Injectable({ providedIn: 'root' })
export class InterestsService {
  private api = '/api/interest-tags';
  private cachedTags: InterestTag[] | null = null;

  constructor(private http: HttpClient) {}

  getInterestTags(): Observable<InterestTag[]> {
    if (this.cachedTags) return of(this.cachedTags);
    return this.http.get<InterestTag[]>(this.api).pipe(
      tap(tags => this.cachedTags = tags)
    );
  }

  getSelectedIds(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveSelectedIds(ids: number[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  getSelectedLabels(): string {
    if (!this.cachedTags) return '';
    const ids = this.getSelectedIds();
    return this.cachedTags
      .filter(t => ids.includes(t.id))
      .map(t => t.name)
      .join(', ');
  }

  hasSelections(): boolean {
    return this.getSelectedIds().length > 0;
  }
}
