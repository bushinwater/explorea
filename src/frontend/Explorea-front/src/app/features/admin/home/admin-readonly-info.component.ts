import { Component } from '@angular/core';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-admin-readonly-info',
  standalone: true,
  templateUrl: './admin-readonly-info.component.html',
  styleUrl: './admin-readonly-info.component.css',
})
export class AdminReadonlyInfoComponent {
  constructor(protected readonly ui: AdminUiPreferencesService) {}
}
