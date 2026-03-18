import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminReservation } from '../../core/models/reservation.model';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-reservations.component.html'
})
export class AdminReservationsComponent implements OnInit, OnDestroy {
  rezervacije = signal<AdminReservation[]>([]);
  ucitavanje = signal<boolean>(false);
  greska = signal<string>('');
  poruka = signal<string>('');

  // filter po statusu - podrazumevano prikazujemo pending
  aktivniFilter = signal<string>('pending');

  // čuvamo referencu na interval da ga možemo ugasiti kada admin ode sa stranice
  private intervalId: any;

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.ucitajRezervacije();

    // osvežavamo svakih 5 sekundi - tako admin vidi nove rezervacije
    // bez da mora ručno da refreshuje stranicu
    this.intervalId = setInterval(() => {
      this.ucitajRezervacije();
    }, 5000);
  }

  // kada admin ode sa stranice, gasimo interval
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

    this.reservationService.getAll().subscribe({
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

  // filtriramo na frontendu da ne pravimo dodatne API pozive
  get filtrirane() {
    return this.rezervacije().filter(r => r.status === this.aktivniFilter());
  }

  odobri(id: number) {
    this.reservationService.odobri(id).subscribe({
      next: () => {
        this.poruka.set('Rezervacija odobrena — knjiga je pozajmljena.');
        // odmah osvežavamo bez čekanja na interval
        this.ucitajRezervacije();
      },
      error: (err) => {
        this.greska.set(err.error?.poruka || 'Greška pri odobravanju.');
      }
    });
  }

  evidentirajPovratak(id: number) {
    this.reservationService.evidentirajPovratak(id).subscribe({
      next: () => {
        this.poruka.set('Povratak knjige evidentiran.');
        // odmah osvežavamo bez čekanja na interval
        this.ucitajRezervacije();
      },
      error: (err) => {
        this.greska.set(err.error?.poruka || 'Greška pri evidentiranju povratka.');
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

  get trenutniKorisnik() {
    return this.authService.trenutniKorisnik();
  }

  odjavi() {
    this.authService.odjavi();
  }
}