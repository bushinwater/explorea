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
  /** i18n key (e.g. FORGOT_PASSWORD.ERROR_OAUTH_NO_PASSWORD) — shown via the
   *  translate pipe instead of the generic "sent" panel when the backend
   *  explicitly refuses with a known error code. */
  serverErrorKey = '';
  /** Raw message fallback when the backend response has no recognized code. */
  serverErrorText = '';

  /** Map of backend error code → i18n key for this page. */
  private static readonly ERROR_CODE_KEYS: Record<string, string> = {
    OAUTH_NO_LOCAL_PASSWORD: 'FORGOT_PASSWORD.ERROR_OAUTH_NO_PASSWORD',
  };

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
    this.serverErrorKey = '';
    this.serverErrorText = '';
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
        const msg: string | undefined = err?.error?.message;
        if (err?.status === 400 && typeof msg === 'string' && msg.length) {
          // Backend prefixes known errors with a stable CODE: "CODE: message"
          // so the frontend can swap in the right i18n key per language.
          const match = msg.match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
          const code = match ? match[1] : null;
          const i18nKey = code ? ForgotPassword.ERROR_CODE_KEYS[code] : null;
          if (i18nKey) {
            this.serverErrorKey = i18nKey;
          } else {
            this.serverErrorText = match ? match[2] : msg;
          }
        } else {
          this.sent = true;
        }
        this.cdr.detectChanges();
      },
    });
  }
}
