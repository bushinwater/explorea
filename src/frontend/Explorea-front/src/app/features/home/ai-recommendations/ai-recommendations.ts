import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import {
  DestinationCard as DestinationCardModel,
  EventCard as EventCardModel,
  ActivityCard as ActivityCardModel,
} from '../../../core/models/home.model';

export interface RecommendationItem {
  id: string;
  entityType: 'destination' | 'event' | 'activity';
  name: string;
  slug: string;
  imageUrl?: string;
  subtitle?: string;
  rating?: number;
  badge?: string;
}

@Component({
  selector: 'app-ai-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './ai-recommendations.html',
  styleUrl: './ai-recommendations.css',
})
export class AiRecommendations {
  @Input() set destinations(val: DestinationCardModel[]) { this._destinations = val; this._items = null; }
  @Input() set events(val: EventCardModel[]) { this._events = val; this._items = null; }
  @Input() set activities(val: ActivityCardModel[]) { this._activities = val; this._items = null; }

  private _destinations: DestinationCardModel[] = [];
  private _events: EventCardModel[] = [];
  private _activities: ActivityCardModel[] = [];
  private _items: RecommendationItem[] | null = null;

  get items(): RecommendationItem[] {
    if (this._items) return this._items;

    const dests: RecommendationItem[] = this._destinations.map(d => ({
      id: d.id, entityType: 'destination', name: d.name, slug: d.slug,
      imageUrl: d.previewImageUrl, subtitle: d.city?.name,
      rating: d.avgRating,
    }));

    const evts: RecommendationItem[] = this._events.map(e => ({
      id: e.id, entityType: 'event', name: e.name, slug: e.slug,
      imageUrl: e.previewImageUrl, subtitle: e.address,
      badge: e.startDatetime ? new Date(e.startDatetime).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' }) : undefined,
    }));

    const acts: RecommendationItem[] = this._activities.map(a => ({
      id: a.id, entityType: 'activity', name: a.name, slug: a.slug,
      imageUrl: a.previewImageUrl, rating: a.avgRating,
      badge: a.durationMinutes ? this.formatDuration(a.durationMinutes) : undefined,
    }));

    // Round-robin interleaving
    const result: RecommendationItem[] = [];
    const max = Math.max(dests.length, evts.length, acts.length);
    for (let i = 0; i < max; i++) {
      if (i < dests.length) result.push(dests[i]);
      if (i < evts.length) result.push(evts[i]);
      if (i < acts.length) result.push(acts[i]);
    }

    this._items = result;
    return result;
  }

  get hasAny(): boolean {
    return this._destinations.length > 0 || this._events.length > 0 || this._activities.length > 0;
  }

  routeFor(item: RecommendationItem): string[] {
    const map: Record<string, string> = { destination: 'destinations', event: 'events', activity: 'activities' };
    return [`/${map[item.entityType]}`, item.slug];
  }

  labelFor(type: string): string {
    const map: Record<string, string> = { destination: 'Destinacija', event: 'Dogadjaj', activity: 'Aktivnost' };
    return map[type] ?? type;
  }

  private formatDuration(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  newsletterEmail = '';
  newsletterSent = false;
  newsletterAlreadySubscribed = false;
  newsletterLoading = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private profileService: ProfileService,
  ) {}

  submitNewsletter() {
    const email = this.newsletterEmail.trim();
    if (!email || this.newsletterLoading) return;

    this.newsletterLoading = true;
    this.newsletterAlreadySubscribed = false;

    if (this.authService.isLoggedIn()) {
      this.profileService.updateNewsletter(true).subscribe({
        next: () => { this.newsletterSent = true; this.newsletterLoading = false; },
        error: () => { this.newsletterLoading = false; },
      });
    } else {
      this.http.post('/api/newsletter/subscribe', { email }, { observe: 'response' }).subscribe({
        next: (res) => {
          this.newsletterLoading = false;
          if (res.status === 201) {
            this.newsletterSent = true;
          } else {
            this.newsletterAlreadySubscribed = true;
          }
        },
        error: () => { this.newsletterLoading = false; },
      });
    }
  }
}
