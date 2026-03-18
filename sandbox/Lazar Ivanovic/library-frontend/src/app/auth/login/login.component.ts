import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],  // dodali smo RouterLink ovde
  templateUrl: './login.component.html'
})
export class LoginComponent {
  // podaci iz forme - two-way binding sa [(ngModel)]
  email = '';
  lozinka = '';

  // signal za grešku - kada se promeni, template se automatski osvežava
  greska = signal<string>('');
  ucitavanje = signal<boolean>(false);

  constructor(private authService: AuthService, private router: Router) {
    // ako je već ulogovan, prebaci na odgovarajući deo aplikacije
    if (authService.jeUlogovan()) {
      this.preusmeri();
    }
  }

  login() {
    // osnovna validacija pre slanja na server
    if (!this.email || !this.lozinka) {
      this.greska.set('Unesite email i lozinku.');
      return;
    }

    this.ucitavanje.set(true);
    this.greska.set('');

    this.authService.login({ email: this.email, password: this.lozinka })
      .subscribe({
        next: (odgovor) => {
          // uspešan login - čuvamo podatke i preusmeravamo
          this.authService.sacuvajLogin(odgovor);
          this.preusmeri();
        },
        error: () => {
          this.greska.set('Pogrešan email ili lozinka.');
          this.ucitavanje.set(false);
        }
      });
  }

  private preusmeri() {
    // admin ide na admin panel, user ide na listu knjiga
    if (this.authService.jeAdmin()) {
      this.router.navigate(['/admin/books']);
    } else {
      this.router.navigate(['/user/books']);
    }
  }
}