import { Injectable } from '@angular/core';

const STORAGE_KEY = 'explorea_avatar';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  getDataUrl(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }

  saveDataUrl(dataUrl: string): void {
    localStorage.setItem(STORAGE_KEY, dataUrl);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
