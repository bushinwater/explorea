import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  ime = '';
  email = '';
  lozinka = '';
  potvrda = '';

  greska = signal<string>('');
  ucitavanje = signal<boolean>(false);

  constructor(private authService: AuthService, private router: Router) {
    // ako je već ulogovan, prebaci na odgovarajući deo
    if (authService.jeUlogovan()) {
      if (authService.jeAdmin()) {
        this.router.navigate(['/admin/books']);
      } else {
        this.router.navigate(['/user/books']);
      }
    }
  }

  registruj() {
    if (!this.ime || !this.email || !this.lozinka) {
      this.greska.set('Sva polja su obavezna.');
      return;
    }

    if (this.lozinka !== this.potvrda) {
      this.greska.set('Lozinke se ne poklapaju.');
      return;
    }

    if (this.lozinka.length < 6) {
      this.greska.set('Lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    this.ucitavanje.set(true);
    this.greska.set('');

    // koristimo HttpClient direktno jer AuthService nema register metodu za frontend
    // dodaćemo je u AuthService
    this.authService.register(this.ime, this.email, this.lozinka).subscribe({
      next: () => {
        // nakon registracije odmah se logujemo
        this.authService.login({ email: this.email, password: this.lozinka })
          .subscribe({
            next: (odgovor) => {
              this.authService.sacuvajLogin(odgovor);
              this.router.navigate(['/user/books']);
            },
            error: () => {
              // registracija je prošla ali login nije - šalji na login stranicu
              this.router.navigate(['/login']);
            }
          });
      },
      error: (err) => {
        this.greska.set(err.error?.poruka || 'Greška pri registraciji.');
        this.ucitavanje.set(false);
      }
    });
  }
}