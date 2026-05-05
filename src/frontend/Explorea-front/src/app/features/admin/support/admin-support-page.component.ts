import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-support-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-support-page.component.html',
  styleUrl: './admin-support-page.component.css',
})
export class AdminSupportPageComponent {}
