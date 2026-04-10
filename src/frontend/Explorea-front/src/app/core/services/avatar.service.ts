import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

const CACHE_KEY = 'explorea_avatar_url';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private cachedUrl: string | null = null;

  constructor(private http: HttpClient) {
    this.cachedUrl = localStorage.getItem(CACHE_KEY);
  }

  getUrl(): string | null {
    return this.cachedUrl;
  }

  setUrl(url: string | null): void {
    this.cachedUrl = url;
    if (url) {
      localStorage.setItem(CACHE_KEY, url);
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  upload(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>('/api/profile/avatar', formData).pipe(
      map(res => {
        this.setUrl(res.url);
        return res.url;
      })
    );
  }

  clear(): void {
    this.cachedUrl = null;
    localStorage.removeItem(CACHE_KEY);
  }
}
