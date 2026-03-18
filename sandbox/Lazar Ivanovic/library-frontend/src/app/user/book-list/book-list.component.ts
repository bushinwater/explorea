import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookService } from '../../core/services/book.service';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { Book } from '../../core/models/book.model';

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './book-list.component.html'
})
export class BookListComponent implements OnInit {
  knjige = signal<Book[]>([]);
  ucitavanje = signal<boolean>(false);
  greska = signal<string>('');
  pojamPretrage = '';
  poruka = signal<string>('');

  constructor(
    private bookService: BookService,
    private reservationService: ReservationService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // ngOnInit se poziva kada se komponenta učita - učitavamo knjige
    this.ucitajKnjige();
  }

  ucitajKnjige() {
    this.ucitavanje.set(true);
    this.bookService.getAll().subscribe({
      next: (knjige) => {
        this.knjige.set(knjige);
        this.ucitavanje.set(false);
      },
      error: () => {
        this.greska.set('Greška pri učitavanju knjiga.');
        this.ucitavanje.set(false);
      }
    });
  }

  pretrazi() {
    if (!this.pojamPretrage.trim()) {
      // ako je polje prazno, učitaj sve knjige
      this.ucitajKnjige();
      return;
    }

    this.ucitavanje.set(true);
    this.bookService.search(this.pojamPretrage).subscribe({
      next: (knjige) => {
        this.knjige.set(knjige);
        this.ucitavanje.set(false);
      },
      error: () => {
        this.greska.set('Greška pri pretrazi.');
        this.ucitavanje.set(false);
      }
    });
  }

  rezervisi(knjigaId: number) {
    this.poruka.set('');
    this.reservationService.rezervisi(knjigaId).subscribe({
      next: () => {
        this.poruka.set('Rezervacija uspešno kreirana!');
        // osvežavamo listu da se ažurira dugme i broj slobodnih primeraka
        this.ucitajKnjige();
      },
      error: (err) => {
        this.poruka.set(err.error?.poruka || 'Greška pri rezervaciji.');
      }
    });
  }

  get trenutniKorisnik() {
    return this.authService.trenutniKorisnik();
  }

  odjavi() {
    this.authService.odjavi();
  }
}