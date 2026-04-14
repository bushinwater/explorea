import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
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
  gender = '';
  dateOfBirth = '';
  genderError = '';
  dateOfBirthError = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {}

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
