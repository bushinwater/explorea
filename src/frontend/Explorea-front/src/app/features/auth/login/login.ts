import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LoginDto } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { BugReportModal } from '../../../shared/components/bug-report-modal/bug-report-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Sidebar, TranslateModule, BottomNav, BugReportModal],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  @ViewChild('passwordInput') passwordInput!: ElementRef<HTMLInputElement>;
  @ViewChild('loginBtn') loginBtn!: ElementRef<HTMLButtonElement>;

  email = '';
  password = '';
  error = '';
  emailError = '';
  showPassword = false;
  emailNotVerified = false;
  resendSent = false;
  loading = false;
  socialLoading: 'google' | null = null;
  returnUrl = '/profile';
  bugReportOpen = false;

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private authService: AuthService,
    private locationService: LocationService,
    public themeService: ThemeService,
    public languageService: LanguageService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/profile';
  }

  validateEmail(): boolean {
    if (!this.email.trim()) {
      this.emailError = 'LOGIN.ERROR_EMAIL_EMPTY';
      return false;
    }
    if (!Login.EMAIL_REGEX.test(this.email.trim())) {
      this.emailError = 'LOGIN.ERROR_EMAIL_INVALID';
      return false;
    }
    this.emailError = '';
    return true;
  }

  onEmailEnter() {
    if (this.validateEmail()) {
      this.passwordInput.nativeElement.focus();
    }
  }

  onPasswordEnter() {
    this.loginBtn.nativeElement.focus();
    this.login();
  }

  resendVerification() {
    if (!this.email || this.resendSent) return;
    this.authService.resendVerification({ email: this.email }).subscribe({
      next: () => { this.resendSent = true; this.cdr.detectChanges(); },
      error: () => { this.resendSent = true; this.cdr.detectChanges(); },
    });
  }

  loginWithGoogle() {
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
      error_callback: () => {
        this.socialLoading = null;
        this.cdr.detectChanges();
      },
    });

    client.requestAccessToken();
  }

  private handleSocialLogin(provider: 'google', token: string) {
    this.authService.socialLogin({ provider, token }).subscribe({
      next: (response) => {
        if (response.socialPendingToken) {
          sessionStorage.setItem('socialPendingToken', response.socialPendingToken);
          this.router.navigate(['/complete-profile']);
          return;
        }
        this.authService.saveTokens(response);
        this.locationService.flushCachedLocation();
        if (response.needsInterests) {
          this.router.navigate(['/interests']);
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: (err) => {
        console.error('[Social login error]', err?.error?.message ?? err);
        this.socialLoading = null;
        const msg: string = err?.error?.message ?? '';
        this.error = msg.toLowerCase().includes('deleted')
          ? 'LOGIN.ERROR_ACCOUNT_DELETED'
          : 'LOGIN.ERROR';
        this.cdr.detectChanges();
      },
    });
  }

  login() {
    this.emailNotVerified = false;
    this.resendSent = false;
    if (!this.validateEmail()) {
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    const dto: LoginDto = {
      email: this.email,
      password: this.password,
    };

    this.authService.login(dto).subscribe({
      next: (response) => {
        this.authService.saveTokens(response);
        this.locationService.flushCachedLocation();
        if (response.needsInterests) {
          this.router.navigate(['/interests']);
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: (err) => {
        this.loading = false;
        const msg: string = err?.error?.message ?? '';
        if (msg === 'EMAIL_NOT_VERIFIED') {
          this.emailNotVerified = true;
        } else if (msg.toLowerCase().includes('deleted')) {
          this.error = 'LOGIN.ERROR_ACCOUNT_DELETED';
        } else {
          this.error = 'LOGIN.ERROR';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
