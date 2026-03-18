import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  private authService = inject(Auth);
  private router = inject(Router);

  fullName = '';
  email = '';
  password = '';
  successMessage = '';
  errorMessage = '';

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    this.authService.register({
      fullName: this.fullName,
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.successMessage = 'Uspešna registracija. Možeš se prijaviti.';
        this.fullName = '';
        this.email = '';
        this.password = '';

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1200);
      },
      error: err => {
        this.errorMessage = err?.error?.message || 'Greška pri registraciji.';
      }
    });
  }
}