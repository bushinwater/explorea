import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalShellComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() confirmLabel = '';
  @Input() cancelLabel = '';
  @Input() loadingLabel = '';
  @Input() isLoading = false;
  @Input() showReasonInput = false;
  @Input() reasonPlaceholder = 'Unesite razlog...';
  @Input() reason = '';
  @Output() readonly reasonChange = new EventEmitter<string>();

  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly confirm = new EventEmitter<void>();

  constructor(protected readonly ui: AdminUiPreferencesService) {}

  protected requestCancel(): void {
    this.cancel.emit();
  }

  protected requestConfirm(): void {
    this.confirm.emit();
  }
}
