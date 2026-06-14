import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  email = '';
  emailError = '';
  loading = false;
  sent = false;
  /** Server-side message (e.g. "ovaj nalog koristi Google login…") — shown
   *  instead of the generic "sent" panel when the backend explicitly refuses. */
  serverError = '';

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  validateEmail(): boolean {
    if (!this.email.trim()) {
      this.emailError = 'LOGIN.ERROR_EMAIL_EMPTY';
      return false;
    }
    if (!ForgotPassword.EMAIL_REGEX.test(this.email.trim())) {
      this.emailError = 'LOGIN.ERROR_EMAIL_INVALID';
      return false;
    }
    this.emailError = '';
    return true;
  }

  submit() {
    if (!this.validateEmail()) {
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.serverError = '';
    this.cdr.detectChanges();

    this.authService.forgotPassword({ email: this.email.trim() }).subscribe({
      next: () => {
        this.loading = false;
        this.sent = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        // 400 with a server message — e.g. OAuth-only account refusing the
        // reset flow — surfaced so the user understands what to do next.
        // Other errors fall back to the "we pretended to send it" panel so
        // we don't leak which emails exist on the platform.
        const msg = err?.error?.message;
        if (err?.status === 400 && typeof msg === 'string' && msg.length) {
          this.serverError = msg;
        } else {
          this.sent = true;
        }
        this.cdr.detectChanges();
      },
    });
  }
}
