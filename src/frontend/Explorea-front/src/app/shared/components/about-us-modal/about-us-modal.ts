import { Component, EventEmitter, HostListener, Output } from '@angular/core';
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
