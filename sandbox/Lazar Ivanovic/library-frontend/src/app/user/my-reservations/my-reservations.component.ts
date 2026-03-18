import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { Reservation } from '../../core/models/reservation.model';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-reservations.component.html'
})
export class MyReservationsComponent implements OnInit, OnDestroy {
  rezervacije = signal<Reservation[]>([]);
  ucitavanje = signal<boolean>(false);
  greska = signal<string>('');
  poruka = signal<string>('');

  // čuvamo referencu na interval da ga možemo ugasiti kada korisnik ode sa stranice
  private intervalId: any;

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.ucitajRezervacije();

    // osvežavamo svakih 5 sekundi - tako korisnik vidi promene statusa
    // bez da mora ručno da refreshuje stranicu
    this.intervalId = setInterval(() => {
      this.ucitajRezervacije();
    }, 5000);
  }

  // kada korisnik ode sa stranice, gasimo interval
  // bez ovoga interval bi nastavio da radi u pozadini i pravio probleme
  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  ucitajRezervacije() {
    // pokazujemo "Učitavanje..." samo pri prvom učitavanju
    // da ekran ne trepće pri svakom automatskom osvežavanju
    if (this.rezervacije().length === 0) {
      this.ucitavanje.set(true);
    }

    this.reservationService.getMoje().subscribe({
      next: (rezervacije) => {
        this.rezervacije.set(rezervacije);
        this.ucitavanje.set(false);
      },
      error: () => {
        this.greska.set('Greška pri učitavanju rezervacija.');
        this.ucitavanje.set(false);
      }
    });
  }

  otkazi(id: number) {
    this.reservationService.otkaziRezervaciju(id).subscribe({
      next: () => {
        this.poruka.set('Rezervacija otkazana.');
        this.ucitajRezervacije();
      },
      error: (err) => {
        this.greska.set(err.error?.poruka || 'Greška pri otkazivanju.');
      }
    });
  }

  // pretvara status u srpski tekst za prikaz
  statusTekst(status: string): string {
    const statusi: Record<string, string> = {
      'pending': 'Čeka odobrenje',
      'approved': 'Pozajmljeno',
      'returned': 'Vraćeno',
      'cancelled': 'Otkazano'
    };
    return statusi[status] || status;
  }

  // formatira datum za prikaz
  formatirajDatum(datum: string): string {
    return new Date(datum).toLocaleDateString('sr-RS');
  }

  // koliko dana ostaje do isteka rezervacije
  danaDoIsteka(expiresAt: string): string {
    const istice = new Date(expiresAt);
    const danas = new Date();
    const razlika = Math.ceil((istice.getTime() - danas.getTime()) / (1000 * 60 * 60 * 24));

    if (razlika <= 0) return 'Isteklo';
    if (razlika === 1) return 'Ističe sutra';
    return `Ističe za ${razlika} dana`;
  }

  get trenutniKorisnik() {
    return this.authService.trenutniKorisnik();
  }

  odjavi() {
    this.authService.odjavi();
  }
}