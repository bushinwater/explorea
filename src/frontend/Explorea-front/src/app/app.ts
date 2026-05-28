import { CommonModule } from '@angular/common';
import { Component, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, filter } from 'rxjs';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';
import { ScrollRestorationService } from './core/services/scroll-restoration.service';
import { AuthService } from './core/services/auth.service';
import { ExpiredPlannerEvent } from './core/models/planner.model';
import { PlannerService } from './core/services/planner.service';
import { ChatBubble } from './shared/components/chat-bubble/chat-bubble';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, ChatBubble],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  protected readonly title = signal('Explorea-front');
  protected expiredPlannerEvents: ExpiredPlannerEvent[] = [];
  protected activeExpiredPlannerEvent: ExpiredPlannerEvent | null = null;
  protected removingExpiredPlannerEvent = false;

  private checkedExpiredPlannerEvents = false;
  private readonly subscription = new Subscription();

  constructor(
    private themeService: ThemeService,
    private languageService: LanguageService,
    private scrollRestoration: ScrollRestorationService,
    private authService: AuthService,
    private plannerService: PlannerService,
    private router: Router,
    private http: HttpClient
  ) {
    this.http.get<{ countryName: string }>('/api/app-info').subscribe({
      next: (info) => {
        document.title = `Explorea - ${info.countryName}`;
      },
      error: () => {
        document.title = 'Explorea';
      }
    });

    this.subscription.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => this.checkExpiredPlannerEvents(event.urlAfterRedirects)),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected dismissExpiredPlannerEvent(): void {
    this.showNextExpiredPlannerEvent();
  }

  protected removeExpiredPlannerEvent(): void {
    const item = this.activeExpiredPlannerEvent;
    if (!item || this.removingExpiredPlannerEvent) return;

    this.removingExpiredPlannerEvent = true;
    this.subscription.add(
      this.plannerService.removeEntry(item.id).subscribe({
        next: () => {
          this.removingExpiredPlannerEvent = false;
          this.showNextExpiredPlannerEvent();
        },
        error: () => {
          this.removingExpiredPlannerEvent = false;
        },
      }),
    );
  }

  protected searchNewEvents(): void {
    this.activeExpiredPlannerEvent = null;
    this.expiredPlannerEvents = [];
    void this.router.navigate(['/search'], { queryParams: { type: 'event' } });
  }

  private checkExpiredPlannerEvents(url: string): void {
    if (this.checkedExpiredPlannerEvents || url.startsWith('/admin') || !this.authService.isLoggedIn()) {
      return;
    }

    this.checkedExpiredPlannerEvents = true;
    this.subscription.add(
      this.plannerService.getExpiredEvents().subscribe({
        next: (items) => {
          this.expiredPlannerEvents = items;
          this.activeExpiredPlannerEvent = items[0] ?? null;
        },
        error: () => {
          this.expiredPlannerEvents = [];
          this.activeExpiredPlannerEvent = null;
        },
      }),
    );
  }

  private showNextExpiredPlannerEvent(): void {
    const current = this.activeExpiredPlannerEvent;
    this.expiredPlannerEvents = current
      ? this.expiredPlannerEvents.filter((item) => item.id !== current.id)
      : this.expiredPlannerEvents.slice(1);
    this.activeExpiredPlannerEvent = this.expiredPlannerEvents[0] ?? null;
  }
}
