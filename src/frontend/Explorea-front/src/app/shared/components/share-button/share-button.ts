import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './share-button.html',
  styleUrl: './share-button.css',
})
export class ShareButton {
  @Input() title = '';
  @Input() url = '';
  @Input() small = false;

  copied = false;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  get shareUrl(): string {
    return this.url || window.location.href;
  }

  get shareTitle(): string {
    return this.title || document.title;
  }

  get canNativeShare(): boolean {
    return !!navigator.share;
  }

  async share(): Promise<void> {
    if (this.canNativeShare) {
      try {
        await navigator.share({ title: this.shareTitle, url: this.shareUrl });
      } catch {
        // korisnik otkazao — nije greška
      }
    } else {
      await navigator.clipboard.writeText(this.shareUrl);
      this.copied = true;
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => { this.copied = false; }, 2000);
    }
  }
}
