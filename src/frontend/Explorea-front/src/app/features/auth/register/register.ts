import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptTerms = false;
  showPassword = false;
  showConfirmPassword = false;
  error = '';
  returnUrl = '/home';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/home';
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  register() {
    if (!this.acceptTerms) {
      this.error = 'REGISTER.ERROR_TERMS';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'REGISTER.ERROR_PASSWORD';
      return;
    }

    const dto: RegisterDto = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      confirmPassword: this.confirmPassword,
    };

    this.authService.register(dto).subscribe({
      next: (response) => {
        this.authService.saveTokens(response);
        if (response.needsInterests) {
          this.router.navigate(['/interests']);
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: () => {
        this.error = 'REGISTER.ERROR_GENERAL';
      },
    });
  }
}
