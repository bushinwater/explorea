import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ResetPasswordDto } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';

  showPassword = false;
  showConfirm = false;

  isLoading = false;
  isSuccess = false;
  error = '';
  passwordError = '';
  showPasswordHint = false;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error = 'RESET_PASSWORD.ERROR_INVALID_LINK';
    }
  }

  get passwordStrength(): 'weak' | 'fair' | 'strong' | null {
    if (!this.newPassword) return null;
    const hasUpper = /[A-Z]/.test(this.newPassword);
    const hasNumber = /[0-9]/.test(this.newPassword);
    const hasSpecial = /[^a-zA-Z0-9]/.test(this.newPassword);
    const long = this.newPassword.length >= 8;
    const score = [hasUpper, hasNumber, hasSpecial, long].filter(Boolean).length;
    if (score <= 2) return 'weak';
    if (score === 3) return 'fair';
    return 'strong';
  }

  goBack() {
    this.router.navigate([this.authService.isLoggedIn() ? '/profile' : '/login']);
  }

  validatePassword(): boolean {
    const hasNumber = /[0-9]/.test(this.newPassword);
    if (!this.newPassword || this.newPassword.length < 6 || !hasNumber) {
      this.passwordError = 'RESET_PASSWORD.ERROR_PASSWORD_WEAK';
      return false;
    }
    this.passwordError = '';
    return true;
  }

  submit() {
    this.error = '';

    if (!this.validatePassword()) return;

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'RESET_PASSWORD.ERROR_MISMATCH';
      return;
    }

    const dto: ResetPasswordDto = {
      token: this.token,
      newPassword: this.newPassword,
    };

    this.isLoading = true;
    this.authService.resetPassword(dto).subscribe({
      next: () => {
        this.isLoading = false;
        this.isSuccess = true;
        const destination = this.authService.isLoggedIn() ? '/profile' : '/login';
        setTimeout(() => this.router.navigate([destination]), 2500);
      },
      error: (err) => {
        this.isLoading = false;
        const msg: string = err?.error?.message ?? '';
        if (msg.toLowerCase().includes('different')) {
          this.error = 'RESET_PASSWORD.ERROR_SAME_PASSWORD';
        } else if (msg.toLowerCase().includes('expired')) {
          this.error = 'RESET_PASSWORD.ERROR_EXPIRED';
        } else {
          this.error = 'RESET_PASSWORD.ERROR_GENERAL';
        }
      },
    });
  }

}
