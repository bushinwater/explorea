import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.css',
})
export class ModalShellComponent {
  @Input({ required: true }) title!: string;
  @Input() description = '';
  @Output() readonly close = new EventEmitter<void>();

  constructor(protected readonly ui: AdminUiPreferencesService) {}

  protected requestClose(): void {
    this.close.emit();
  }
}
