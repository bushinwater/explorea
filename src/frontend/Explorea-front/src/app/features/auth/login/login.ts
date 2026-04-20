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

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Sidebar, TranslateModule, BottomNav],
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
  socialLoading: 'google' | 'facebook' | null = null;
  returnUrl = '/profile';

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private static readonly FB_APP_ID = '2054189815159488';

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
    });

    client.requestAccessToken();
  }

  loginWithFacebook() {
    const redirectUri = `${window.location.origin}/auth/facebook/callback`;
    const url = `https://www.facebook.com/dialog/oauth?client_id=${Login.FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=public_profile,email&response_type=code`;

    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(url, 'facebook-login', `width=${width},height=${height},left=${left},top=${top}`);

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
          this.locationService.flushCachedLocation();
          if (response.needsProfileCompletion) {
            this.router.navigate(['/complete-profile']);
          } else if (response.needsInterests) {
            this.router.navigate(['/interests']);
          } else {
            this.router.navigateByUrl(this.returnUrl);
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
        this.error = 'LOGIN.ERROR';
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
        } else {
          this.error = 'LOGIN.ERROR';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
