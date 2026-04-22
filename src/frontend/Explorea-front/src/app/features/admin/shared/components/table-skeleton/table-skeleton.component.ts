import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  templateUrl: './table-skeleton.component.html',
  styleUrl: './table-skeleton.component.css',
})
export class TableSkeletonComponent {
  @Input() rows = 5;

  protected get rowIndexes(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }
}
