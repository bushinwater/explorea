import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css',
})
export class VerifyEmail implements OnInit {
  state: 'loading' | 'success' | 'error' = 'loading';
  isLoggedIn = false;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!token) {
      this.state = 'error';
      this.cdr.detectChanges();
      return;
    }

    this.authService.verifyEmail({ token }).subscribe({
      next: (response) => {
        this.authService.saveTokens(response);
        this.state = 'success';
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/interests']), 1500);
      },
      error: () => {
        this.state = 'error';
        this.cdr.detectChanges();
      },
    });
  }

  goHome() {
    this.router.navigate([this.isLoggedIn ? '/profile' : '/login']);
  }
}
