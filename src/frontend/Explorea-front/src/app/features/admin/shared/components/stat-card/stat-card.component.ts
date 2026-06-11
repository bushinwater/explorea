import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { formatCompactCount } from '../../../core/utils/compact-number.utils';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.css',
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() hint = '';
  @Input() trend = '';
  @Input() tone: 'neutral' | 'success' | 'danger' = 'neutral';

  protected get toneClass(): string {
    return `stat-card--${this.tone}`;
  }

  /** Auto-compacts numeric values >= 1000 to 1k+ / 1M+ / 1B+ form. */
  protected get displayValue(): string {
    if (typeof this.value === 'number') {
      return this.value >= 1000 ? formatCompactCount(this.value) : this.value.toString();
    }
    return this.value;
  }
}
