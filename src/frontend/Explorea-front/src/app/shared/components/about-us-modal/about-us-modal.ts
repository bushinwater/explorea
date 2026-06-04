import { Component, EventEmitter, HostListener, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-about-us-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './about-us-modal.html',
  styleUrl: './about-us-modal.css',
})
export class AboutUsModal {
  @Output() closed = new EventEmitter<void>();
  private scrollY = 0;
  private lockedBody = false;

  ngOnInit(): void {
    this.lockBodyScroll();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  private lockBodyScroll(): void {
    if (document.body.style.position === 'fixed') return;

    this.scrollY = window.scrollY;
    this.lockedBody = true;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (!this.lockedBody) return;

    this.lockedBody = false;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.scrollY, behavior: 'instant' as ScrollBehavior });
  }
}
