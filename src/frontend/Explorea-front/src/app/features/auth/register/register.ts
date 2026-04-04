import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
export class Register {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptTerms = false;
  showPassword = false;
  showConfirmPassword = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  register() {
    if (!this.acceptTerms) {
      this.error = 'Morate prihvatiti uslove korišćenja.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Lozinke se ne poklapaju.';
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
          this.router.navigate(['/home']);
        }
      },
      error: () => {
        this.error = 'Registracija nije uspela. Pokušajte ponovo.';
      },
    });
  }
}
