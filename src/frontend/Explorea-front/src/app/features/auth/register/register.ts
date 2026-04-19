import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterDto } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Sidebar, TranslateModule, BottomNav],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnInit {
  @ViewChild('passwordInput') passwordInput!: ElementRef<HTMLInputElement>;
  @ViewChild('confirmPasswordInput') confirmPasswordInput!: ElementRef<HTMLInputElement>;
  @ViewChild('registerBtn') registerBtn!: ElementRef<HTMLButtonElement>;

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  gender = '';
  dateOfBirth = '';
  acceptTerms = false;
  showPassword = false;
  showConfirmPassword = false;

  error = '';
  emailError = '';
  emailChecking = false;
  firstNameError = '';
  lastNameError = '';
  genderError = '';
  dateOfBirthError = '';
  passwordError = '';
  showPasswordHint = false;

  registrationDone = false;
  resendSent = false;
  loading = false;
  socialLoading: 'google' | 'facebook' | null = null;
  activeModal: 'terms' | 'privacy' | null = null;

  readonly termsSections = [
    { title: 'REGISTER.LEGAL.TERMS_S1_TITLE', body: 'REGISTER.LEGAL.TERMS_S1_BODY' },
    { title: 'REGISTER.LEGAL.TERMS_S2_TITLE', body: 'REGISTER.LEGAL.TERMS_S2_BODY' },
    { title: 'REGISTER.LEGAL.TERMS_S3_TITLE', body: 'REGISTER.LEGAL.TERMS_S3_BODY' },
    { title: 'REGISTER.LEGAL.TERMS_S4_TITLE', body: 'REGISTER.LEGAL.TERMS_S4_BODY' },
    { title: 'REGISTER.LEGAL.TERMS_S5_TITLE', body: 'REGISTER.LEGAL.TERMS_S5_BODY' },
  ];

  readonly privacySections = [
    { title: 'REGISTER.LEGAL.PRIVACY_S1_TITLE', body: 'REGISTER.LEGAL.PRIVACY_S1_BODY' },
    { title: 'REGISTER.LEGAL.PRIVACY_S2_TITLE', body: 'REGISTER.LEGAL.PRIVACY_S2_BODY' },
    { title: 'REGISTER.LEGAL.PRIVACY_S3_TITLE', body: 'REGISTER.LEGAL.PRIVACY_S3_BODY' },
    { title: 'REGISTER.LEGAL.PRIVACY_S4_TITLE', body: 'REGISTER.LEGAL.PRIVACY_S4_BODY' },
    { title: 'REGISTER.LEGAL.PRIVACY_S5_TITLE', body: 'REGISTER.LEGAL.PRIVACY_S5_BODY' },
  ];

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly NAME_REGEX  = /^[a-zA-ZčćžšđČĆŽŠĐ]+$/;
  private static readonly NAME_BLACKLIST = [
    'kurac', 'kurац', 'picka', 'pička', 'pizda', 'guzica', 'sisa', 'jebem', 'jebo',
    'nigger', 'nigga', 'niger', 'fuck', 'shit', 'dick', 'cunt', 'bitch', 'asshole',
    'retard', 'faggot', 'pussy', 'cock', 'whore', 'slut',
  ];

  private static readonly FB_APP_ID = '2054189815159488';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {}

  registerWithGoogle() {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;

    this.socialLoading = 'google';
    this.cdr.detectChanges();

    const client = google.accounts.oauth2.initTokenClient({
      client_id: '758311997770-l1tn09bqi3892kfhmr3ini1ovsdenb26.apps.googleusercontent.com',
      scope: 'email profile openid',
      callback: (response: { access_token?: string }) => {
        if (!response.access_token) {
          this.socialLoading = null;
          this.cdr.detectChanges();
          return;
        }
        this.handleSocialLogin('google', response.access_token);
        this.cdr.detectChanges();
      },
    });

    client.requestAccessToken();
  }

  registerWithFacebook() {
    const redirectUri = `${window.location.origin}/auth/facebook/callback`;
    const url = `https://www.facebook.com/dialog/oauth?client_id=${Register.FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=public_profile,email&response_type=code`;

    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(url, 'facebook-register', `width=${width},height=${height},left=${left},top=${top}`);

    this.socialLoading = 'facebook';
    this.cdr.detectChanges();

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'facebook-oauth-code') return;
      window.removeEventListener('message', handler);
      clearInterval(closedCheck);
      if (!event.data.code) {
        this.socialLoading = null;
        this.cdr.detectChanges();
        return;
      }
      this.authService.socialLogin({ provider: 'facebook', code: event.data.code, redirectUri }).subscribe({
        next: (response) => {
          this.authService.saveTokens(response);
          if (response.needsProfileCompletion) {
            this.router.navigate(['/complete-profile']);
          } else if (response.needsInterests) {
            this.router.navigate(['/interests']);
          } else {
            this.router.navigate(['/profile']);
          }
        },
        error: () => {
          this.socialLoading = null;
          this.error = 'LOGIN.ERROR';
          this.cdr.detectChanges();
        },
      });
    };
    window.addEventListener('message', handler);

    const closedCheck = setInterval(() => {
      if (popup?.closed) {
        clearInterval(closedCheck);
        window.removeEventListener('message', handler);
        if (this.socialLoading === 'facebook') {
          this.socialLoading = null;
          this.cdr.detectChanges();
        }
      }
    }, 500);
  }

  private handleSocialLogin(provider: 'google' | 'facebook', token: string) {
    this.authService.socialLogin({ provider, token }).subscribe({
      next: (response) => {
        if (response.socialPendingToken) {
          sessionStorage.setItem('socialPendingToken', response.socialPendingToken);
          this.router.navigate(['/complete-profile']);
          return;
        }
        this.authService.saveTokens(response);
        if (response.needsInterests) {
          this.router.navigate(['/interests']);
        } else {
          this.router.navigate(['/profile']);
        }
      },
      error: (err) => {
        console.error('[Social login error]', err?.error?.message ?? err);
        this.socialLoading = null;
        this.error = 'LOGIN.ERROR';
        this.cdr.detectChanges();
      },
    });
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

  get activeSections() {
    return this.activeModal === 'terms' ? this.termsSections : this.privacySections;
  }

  get passwordStrength(): 'weak' | 'fair' | 'strong' | null {
    if (!this.password) return null;
    const hasUpper   = /[A-Z]/.test(this.password);
    const hasNumber  = /[0-9]/.test(this.password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(this.password);
    const long       = this.password.length >= 8;
    const score = [hasUpper, hasNumber, hasSpecial, long].filter(Boolean).length;
    if (score <= 2) return 'weak';
    if (score === 3) return 'fair';
    return 'strong';
  }

  onTermsChange() {
    if (this.acceptTerms && this.error === 'REGISTER.ERROR_TERMS') {
      this.error = '';
    }
  }

  validateEmail(): boolean {
    if (!this.email.trim()) {
      this.emailError = 'LOGIN.ERROR_EMAIL_EMPTY';
      return false;
    }
    if (!Register.EMAIL_REGEX.test(this.email.trim())) {
      this.emailError = 'LOGIN.ERROR_EMAIL_INVALID';
      return false;
    }
    this.emailError = '';
    return true;
  }

  onEmailBlur() {
    if (!this.validateEmail()) return;
    this.emailChecking = true;
    this.cdr.detectChanges();
    this.authService.checkEmail(this.email.trim()).subscribe({
      next: ({ exists }) => {
        this.emailChecking = false;
        if (exists) this.emailError = 'REGISTER.ERROR_EMAIL_TAKEN';
        this.cdr.detectChanges();
      },
      error: () => {
        this.emailChecking = false;
        this.cdr.detectChanges();
      },
    });
  }

  private validateName(value: string): string {
    const v = value.trim();
    if (!v) return 'REGISTER.ERROR_NAME_EMPTY';
    if (!Register.NAME_REGEX.test(v)) return 'REGISTER.ERROR_NAME_INVALID';
    if (Register.NAME_BLACKLIST.some(w => v.toLowerCase().includes(w))) return 'REGISTER.ERROR_NAME_BLACKLIST';
    return '';
  }

  validateFirstName(): boolean {
    this.firstNameError = this.validateName(this.firstName);
    return !this.firstNameError;
  }

  validateLastName(): boolean {
    this.lastNameError = this.validateName(this.lastName);
    return !this.lastNameError;
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }

  onEmailEnter() {
    if (this.validateEmail()) this.passwordInput.nativeElement.focus();
  }

  onPasswordEnter() {
    this.confirmPasswordInput.nativeElement.focus();
  }

  onConfirmPasswordEnter() {
    this.registerBtn.nativeElement.focus();
    this.register();
  }

  resendVerification() {
    if (this.resendSent) return;
    this.authService.resendVerification({ email: this.email }).subscribe({
      next: () => { this.resendSent = true; this.cdr.detectChanges(); },
      error: () => { this.resendSent = true; this.cdr.detectChanges(); },
    });
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

  validatePassword(): boolean {
    const hasNumber = /[0-9]/.test(this.password);
    if (!this.password || this.password.length < 6 || !hasNumber) {
      this.passwordError = 'REGISTER.ERROR_PASSWORD_WEAK';
      return false;
    }
    this.passwordError = '';
    return true;
  }

  register() {
    const emailOk     = this.validateEmail();
    const firstNameOk = this.validateFirstName();
    const lastNameOk  = this.validateLastName();
    const genderOk    = this.validateGender();
    const dobOk       = this.validateDateOfBirth();
    const passwordOk  = this.validatePassword();

    if (!emailOk || !firstNameOk || !lastNameOk || !genderOk || !dobOk || !passwordOk || this.emailChecking) {
      this.cdr.detectChanges();
      return;
    }

    if (!this.acceptTerms) {
      this.error = 'REGISTER.ERROR_TERMS';
      this.cdr.detectChanges();
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'REGISTER.ERROR_PASSWORD';
      this.cdr.detectChanges();
      return;
    }

    const dto: RegisterDto = {
      firstName: this.firstName.trim(),
      lastName:  this.lastName.trim(),
      email:     this.email.trim(),
      password:  this.password,
      confirmPassword: this.confirmPassword,
      gender: this.gender,
      dateOfBirth: this.dateOfBirth,
    };

    this.loading = true;
    this.cdr.detectChanges();

    this.authService.register(dto).subscribe({
      next: () => {
        this.loading = false;
        // Don't save tokens — user must verify email first
        this.registrationDone = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        const msg: string = err?.error?.message ?? '';
        if (msg.toLowerCase().includes('already exists')) {
          this.emailError = 'REGISTER.ERROR_EMAIL_TAKEN';
        } else {
          this.error = 'REGISTER.ERROR_GENERAL';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
