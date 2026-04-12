import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

const LOCATION_KEY = 'user_location';
const LOCATION_ASKED_KEY = 'location_asked';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private api = '/api/users/me/location';

  constructor(private http: HttpClient, private authService: AuthService) {}

  /** Called on home screen init. Asks for permission once, then stores or sends. */
  requestAndStore(): void {
    if (!navigator.geolocation) return;
    if (localStorage.getItem(LOCATION_ASKED_KEY)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem(LOCATION_ASKED_KEY, '1');
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (this.authService.isLoggedIn()) {
          this.sendToBackend(lat, lng);
        } else {
          localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng }));
        }
      },
      () => {
        // Denied or error — mark as asked so we don't prompt again
        localStorage.setItem(LOCATION_ASKED_KEY, '1');
      },
    );
  }

  /** Called right after login/social-login success. Flushes cached location to backend. */
  flushCachedLocation(): void {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return;

    try {
      const { lat, lng } = JSON.parse(raw) as { lat: number; lng: number };
      localStorage.removeItem(LOCATION_KEY);
      this.sendToBackend(lat, lng);
    } catch {
      localStorage.removeItem(LOCATION_KEY);
    }
  }

  private sendToBackend(lat: number, lng: number): void {
    this.http.put(this.api, { lat, lng }).subscribe();
  }
}
