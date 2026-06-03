import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminUserGender, AdminUserRole, AdminUserStatus, UpsertAdminUserDto } from '@shared/models';
import { FeedbackBannerComponent } from '@shared/components/feedback-banner/feedback-banner.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-user-create-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalShellComponent, FeedbackBannerComponent],
  templateUrl: './user-create-modal.component.html',
  styleUrl: './user-create-modal.component.css',
})
export class UserCreateModalComponent {
  @Input({ required: true }) regions!: string[];
  @Input({ required: true }) ui!: AdminUiPreferencesService;
  @Input() countries: { id: number; name: string }[] = [];
  @Input() lockedRegion: string | null = null;
  @Input() isSaving = false;
  @Input() errorMessage = '';

  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly submitUser = new EventEmitter<UpsertAdminUserDto>();

  protected readonly roles: Array<Exclude<AdminUserRole, 'traveler'>> = [
    'super_admin',
    'tourist_organization',
    'place_owner',
  ];

  protected readonly genders: Array<Exclude<AdminUserGender, 'unknown'>> = ['male', 'female', 'other'];

  protected readonly statuses: AdminUserStatus[] = ['active', 'pending', 'revoked'];

  protected readonly form;

  constructor(private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.nonNullable.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['tourist_organization' as Exclude<AdminUserRole, 'traveler'>, [Validators.required]],
      region: [''],
      countryId: new FormControl<number | null>(null),
      gender: ['male' as Exclude<AdminUserGender, 'unknown'>],
      age: [null as number | null],
      status: ['pending' as AdminUserStatus, [Validators.required]],
    });
  }

  ngOnInit(): void {
    const region = this.lockedRegion;
    const regionControl = this.form.controls.region;

    if (region) {
      regionControl.setValue(region);
      regionControl.disable({ emitEvent: false });
      return;
    }

    regionControl.enable({ emitEvent: false });
  }

  protected get showLocationFields(): boolean {
    const role = this.form.controls.role.value;
    return role === 'super_admin' || role === 'tourist_organization';
  }

  protected requestClose(): void {
    this.cancel.emit();
  }

  protected roleLabel(role: Exclude<AdminUserRole, 'traveler'>): string {
    return this.ui.t(`role.${role}`);
  }

  protected genderLabel(gender: Exclude<AdminUserGender, 'unknown'>): string {
    return this.ui.t(`users.filter.gender.${gender}`);
  }

  protected statusLabel(status: AdminUserStatus): string {
    return this.ui.t(`users.status.${status}`);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    this.submitUser.emit({
      firstName: rawValue.firstName,
      lastName: rawValue.lastName,
      email: rawValue.email,
      role: rawValue.role,
      region: rawValue.region || null,
      countryId: this.showLocationFields ? rawValue.countryId : null,
      gender: rawValue.gender || null,
      age: rawValue.age,
      status: rawValue.status,
    });
  }
}
