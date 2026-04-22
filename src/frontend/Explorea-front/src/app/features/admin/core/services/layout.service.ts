import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly customizeOpen   = signal(false);
  readonly sidebarExpanded = signal(false);
  readonly mobileMenuOpen  = signal(false);

  openCustomize():  void { this.customizeOpen.set(true);    }
  closeCustomize(): void { this.customizeOpen.set(false);   }

  toggleDesktopSidebar(): void { this.sidebarExpanded.update(v => !v); }
  toggleMobileSidebar():  void { this.mobileMenuOpen.update(v => !v);  }
  closeMobileSidebar():   void { this.mobileMenuOpen.set(false);        }
}
