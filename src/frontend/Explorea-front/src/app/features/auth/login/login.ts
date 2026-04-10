import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LoginDto } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
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
  returnUrl = '/profile';

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private authService: AuthService,
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
