import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarService } from '../../../core/services/avatar.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, Sidebar, BottomNav],
  templateUrl: './complete-profile.html',
  styleUrl: './complete-profile.css',
})
export class CompleteProfile implements OnInit {
  @ViewChild('dobMonthInput') dobMonthInput!: ElementRef<HTMLInputElement>;
  @ViewChild('dobYearInput')  dobYearInput!: ElementRef<HTMLInputElement>;
  @ViewChild('submitBtn')     submitBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('dobPicker')     dobPicker!: ElementRef<HTMLInputElement>;

  gender = '';
  dateOfBirth = '';
  dobDay   = '';
  dobMonth = '';
  dobYear  = '';
  genderError = '';
  dateOfBirthError = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private avatarService: AvatarService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {}

  private rebuildDob() {
    if (this.dobDay && this.dobMonth && this.dobYear) {
      const d = this.dobDay.padStart(2, '0');
      const m = this.dobMonth.padStart(2, '0');
      this.dateOfBirth = `${this.dobYear}-${m}-${d}`;
    } else {
      this.dateOfBirth = '';
    }
  }

  onDobDayChange() {
    this.dateOfBirthError = '';
    this.dobDay = this.dobDay.replace(/\D/g, '').slice(0, 2);
    this.rebuildDob();
    this.cdr.detectChanges();
    if (this.dobDay.length === 2) {
      this.dobMonthInput.nativeElement.focus();
    }
  }

  onDobMonthChange() {
    this.dateOfBirthError = '';
    this.dobMonth = this.dobMonth.replace(/\D/g, '').slice(0, 2);
    this.rebuildDob();
    this.cdr.detectChanges();
    if (this.dobMonth.length === 2) {
      this.dobYearInput.nativeElement.focus();
    }
  }

  onDobYearChange() {
    this.dateOfBirthError = '';
    this.dobYear = this.dobYear.replace(/\D/g, '').slice(0, 4);
    this.rebuildDob();
    this.cdr.detectChanges();
  }

  onDobYearEnter() {
    this.submitBtn.nativeElement.focus();
  }

  openPicker() {
    this.dobPicker.nativeElement.showPicker();
  }

  onPickerChange(event: Event) {
    const value = (event.target as HTMLInputElement).value; // yyyy-mm-dd
    if (!value) return;
    const [y, m, d] = value.split('-');
    this.dobYear  = y;
    this.dobMonth = m;
    this.dobDay   = d;
    this.dateOfBirthError = '';
    this.rebuildDob();
    this.cdr.detectChanges();
  }

  get minDate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 120);
    return d.toISOString().split('T')[0];
  }

  get maxDate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 10);
    return d.toISOString().split('T')[0];
  }

  validateGender(): boolean {
    if (!this.gender) {
      this.genderError = 'REGISTER.ERROR_GENDER_EMPTY';
      return false;
    }
    this.genderError = '';
    return true;
  }

  validateDateOfBirth(): boolean {
    if (!this.dateOfBirth) {
      this.dateOfBirthError = 'REGISTER.ERROR_DOB_EMPTY';
      return false;
    }
    const entered = new Date(this.dateOfBirth);
    const min = new Date(this.minDate);
    const max = new Date(this.maxDate);
    if (isNaN(entered.getTime()) || entered < min || entered > max) {
      this.dateOfBirthError = 'REGISTER.ERROR_DOB_INVALID';
      return false;
    }
    this.dateOfBirthError = '';
    return true;
  }

  submit() {
    const genderOk = this.validateGender();
    const dobOk = this.validateDateOfBirth();
    if (!genderOk || !dobOk) {
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    const socialPendingToken = sessionStorage.getItem('socialPendingToken');

    if (socialPendingToken) {
      this.authService.completeSocial({
        pendingToken: socialPendingToken,
        gender: this.gender,
        dateOfBirth: this.dateOfBirth,
      }).subscribe({
        next: (response) => {
          sessionStorage.removeItem('socialPendingToken');
          this.authService.saveTokens(response);
          if (response.profileImageUrl) {
            this.avatarService.setUrl(response.profileImageUrl);
          }
          this.router.navigate(['/interests']);
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
    } else {
      this.authService.completeProfile({ gender: this.gender, dateOfBirth: this.dateOfBirth }).subscribe({
        next: () => {
          this.router.navigate(['/interests']);
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
    }
  }
}
