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

  private async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  async share(): Promise<void> {
    if (this.canNativeShare) {
      try {
        await navigator.share({ title: this.shareTitle, url: this.shareUrl });
      } catch {
        // korisnik otkazao — nije greška
      }
    } else {
      await this.copyToClipboard(this.shareUrl);
      this.copied = true;
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => { this.copied = false; }, 2000);
    }
  }
}
