import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="logo-icon">💪</span>
          <h1>FitLogger</h1>
        </div>
        <h2>Registracija</h2>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Ime</label>
            <input type="text" formControlName="name" placeholder="Ime i prezime" />
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" formControlName="email" placeholder="vas@email.com" />
          </div>
          <div class="field">
            <label>Lozinka</label>
            <input type="password" formControlName="password" placeholder="Min. 6 karaktera" />
          </div>
          <div class="form-error" *ngIf="error">{{ error }}</div>
          <div class="form-success" *ngIf="success">{{ success }}</div>
          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Učitavanje...' : 'Registruj se' }}
          </button>
        </form>

        <p class="auth-link">Imaš nalog? <a routerLink="/login">Prijavi se</a></p>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  error = '';
  success = '';
  loading = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password, name } = this.form.value;
    this.auth.register(email!, password!, name!).subscribe({
      next: () => {
        this.success = 'Registracija uspešna! Preusmeravanje...';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: () => {
        this.error = 'Greška pri registraciji. Email možda već postoji.';
        this.loading = false;
      },
    });
  }
}
