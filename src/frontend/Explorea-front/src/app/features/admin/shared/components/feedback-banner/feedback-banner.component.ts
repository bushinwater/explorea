import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-feedback-banner',
  standalone: true,
  imports: [NgClass],
  templateUrl: './feedback-banner.component.html',
  styleUrl: './feedback-banner.component.css',
})
export class FeedbackBannerComponent {
  @Input() variant: 'info' | 'error' = 'info';
  @Input({ required: true }) title!: string;
  @Input() description = '';

  protected get bannerClass(): string {
    return `feedback-banner--${this.variant}`;
  }
}
