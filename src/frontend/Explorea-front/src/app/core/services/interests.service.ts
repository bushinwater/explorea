import { Injectable } from '@angular/core';

const STORAGE_KEY = 'explorea_selected_interests';

@Injectable({ providedIn: 'root' })
export class InterestsService {
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

  hasSelections(): boolean {
    return this.getSelectedIds().length > 0;
  }
}
