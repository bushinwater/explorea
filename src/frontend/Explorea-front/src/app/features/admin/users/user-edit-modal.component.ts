import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AdminUserGender,
  AdminUserRole,
  AdminUserStatus,
  UpdateAdminUserDto,
  UserDirectoryUser,
} from '@shared/models';
import { FeedbackBannerComponent } from '@shared/components/feedback-banner/feedback-banner.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

@Component({
  selector: 'app-user-edit-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalShellComponent, FeedbackBannerComponent],
  templateUrl: './user-edit-modal.component.html',
  styleUrl: './user-edit-modal.component.css',
})
export class UserEditModalComponent {
  @Input({ required: true }) user!: UserDirectoryUser;
  @Input({ required: true }) regions!: string[];
  @Input({ required: true }) ui!: AdminUiPreferencesService;
  @Input() lockedRegion: string | null = null;
  @Input() isSaving = false;
  @Input() errorMessage = '';

  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly submitUser = new EventEmitter<UpdateAdminUserDto>();

  protected readonly roles: AdminUserRole[] = [
    'super_admin',
    'tourist_organization',
    'place_owner',
    'traveler',
  ];

  protected readonly genders: Array<Exclude<AdminUserGender, 'unknown'>> = ['male', 'female', 'other'];

  protected readonly statuses: AdminUserStatus[] = ['active', 'pending', 'revoked'];

  protected readonly form;

  constructor(private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.nonNullable.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['tourist_organization' as AdminUserRole, [Validators.required]],
      region: [''],
      gender: ['male' as Exclude<AdminUserGender, 'unknown'>],
      age: [null as number | null],
      status: ['pending' as AdminUserStatus, [Validators.required]],
    });
  }

  ngOnInit(): void {
    const user = this.user;
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      region: user.regionName ?? '',
      gender: (user.gender === 'unknown' ? 'male' : user.gender) as Exclude<AdminUserGender, 'unknown'>,
      age: user.age,
      status: user.status,
    });

    const region = this.lockedRegion;
    const regionControl = this.form.controls.region;

    if (region) {
      regionControl.setValue(region);
      regionControl.disable({ emitEvent: false });
      return;
    }

    regionControl.enable({ emitEvent: false });
  }

  protected requestClose(): void {
    this.cancel.emit();
  }

  protected roleLabel(role: AdminUserRole): string {
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
      id: this.user.id,
      firstName: rawValue.firstName,
      lastName: rawValue.lastName,
      email: rawValue.email,
      role: rawValue.role,
      region: rawValue.region || null,
      gender: rawValue.gender || null,
      age: rawValue.age,
      status: rawValue.status,
    });
  }
}
