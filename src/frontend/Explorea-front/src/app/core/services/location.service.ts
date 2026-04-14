import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

const LOCATION_KEY         = 'user_location';
const LOCATION_ENABLED_KEY = 'location_enabled';
const LOCATION_ASKED_KEY   = 'location_asked';
const INTERVAL_MS          = 15 * 60 * 1000; // 15 minutes
const MOVE_THRESHOLD_KM    = 0.3;             // 300 metres — below this, skip update

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly api = '/api/users/me/location';
  private trackingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {
    // Resume tracking if the user had it enabled in a previous session.
    // Also fetch immediately so we have a fresh position before the first interval fires.
    if (this.isEnabled()) {
      this.fetchAndStore();
      this.startTracking();
    }
  }

  // ─── Public API ───────────────────────────────────────────────

  isEnabled(): boolean {
    return localStorage.getItem(LOCATION_ENABLED_KEY) === 'true';
  }

  /** Enable location sharing: get coords now, then every 15 min. */
  enable(): void {
    localStorage.setItem(LOCATION_ENABLED_KEY, 'true');
    this.fetchAndStore();
    this.startTracking();
  }

  /**
   * Disable location sharing.
   * Last known location is intentionally kept in the backend.
   */
  disable(): void {
    localStorage.setItem(LOCATION_ENABLED_KEY, 'false');
    this.stopTracking();
  }

  /** Returns the last cached coords, or null if none. */
  getCached(): { lat: number; lng: number } | null {
    try {
      const raw = localStorage.getItem(LOCATION_KEY);
      return raw ? (JSON.parse(raw) as { lat: number; lng: number }) : null;
    } catch {
      return null;
    }
  }

  /**
   * Called after login: flush the locally cached location to the backend
   * so logged-in users' coordinates are always up to date.
   */
  flushCachedLocation(): void {
    if (!this.isEnabled()) return;
    const cached = this.getCached();
    if (cached) this.sendToBackend(cached.lat, cached.lng);
  }

  // ─── Internal ─────────────────────────────────────────────────

  /** Public: called from home page on init to refresh coords if already enabled. */
  requestAndStore(): void {
    if (!this.isEnabled()) return;
    this.fetchAndStore();
  }

  /**
   * Called on home page load: triggers the browser's native location prompt
   * the first time the user visits. If granted, tracking is enabled automatically.
   * Requires a secure context (HTTPS or localhost) — silently skipped otherwise.
   */
  requestIfFirstTime(): void {
    if (this.isEnabled()) {
      this.fetchAndStore();
      return;
    }
    if (!navigator.geolocation) return;
    if (!window.isSecureContext) return;
    if (localStorage.getItem(LOCATION_ASKED_KEY) === 'true') return;

    localStorage.setItem(LOCATION_ASKED_KEY, 'true');
    navigator.geolocation.getCurrentPosition(
      () => { this.enable(); },
      () => { /* denied or unavailable — don't enable */ },
      { timeout: 10000, maximumAge: 60_000 },
    );
  }

  private fetchAndStore(): void {
    if (!navigator.geolocation || !window.isSecureContext) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const cached = this.getCached();
        if (cached && haversineKm(cached.lat, cached.lng, lat, lng) < MOVE_THRESHOLD_KM) {
          return; // Not enough movement — skip cache write and backend call
        }
        localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng }));
        if (this.authService.isLoggedIn()) this.sendToBackend(lat, lng);
      },
      () => { /* denied or unavailable — silently ignore */ },
      { timeout: 5000, maximumAge: 60_000 },
    );
  }

  private startTracking(): void {
    if (this.trackingTimer !== null) return;
    this.trackingTimer = setInterval(() => {
      if (this.isEnabled()) this.fetchAndStore();
    }, INTERVAL_MS);
  }

  private stopTracking(): void {
    if (this.trackingTimer !== null) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = null;
    }
  }

  private sendToBackend(lat: number, lng: number): void {
    this.http.put(this.api, { lat, lng }).subscribe();
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
