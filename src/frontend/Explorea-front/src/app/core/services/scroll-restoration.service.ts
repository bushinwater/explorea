import { Injectable } from '@angular/core';
import { NavigationStart, NavigationEnd, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ScrollRestorationService {
  private saved = new Map<string, number>();
  private pendingRestore: number | null = null;

  constructor(router: Router) {
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual';
    }

    let currentUrl = '';

    router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        if (currentUrl) {
          this.saved.set(currentUrl, window.scrollY);
        }
        if (event.navigationTrigger === 'popstate') {
          this.pendingRestore = this.saved.get(event.url) ?? 0;
        } else {
          this.pendingRestore = null;
        }
      }

      if (event instanceof NavigationEnd) {
        currentUrl = event.urlAfterRedirects;
        if (this.pendingRestore !== null) {
          this.restore(this.pendingRestore);
          this.pendingRestore = null;
        } else {
          window.scrollTo(0, 0);
        }
      }
    });
  }

  private restore(y: number, deadline = Date.now() + 2000): void {
    if (y === 0) {
      window.scrollTo(0, 0);
      return;
    }
    const needed = y + window.innerHeight * 0.5;
    if (document.documentElement.scrollHeight >= needed) {
      window.scrollTo({ top: y, behavior: 'instant' });
    } else if (Date.now() < deadline) {
      requestAnimationFrame(() => this.restore(y, deadline));
    }
  }
}
