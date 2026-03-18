import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookService } from '../../core/services/book.service';
import { AuthService } from '../../core/services/auth.service';
import { Book, CreateBookRequest } from '../../core/models/book.model';

@Component({
  selector: 'app-admin-books',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-books.component.html'
})
export class AdminBooksComponent implements OnInit {
  knjige = signal<Book[]>([]);
  ucitavanje = signal<boolean>(false);
  greska = signal<string>('');
  poruka = signal<string>('');

  // da li je forma za dodavanje/editovanje otvorena
  prikaziFormu = signal<boolean>(false);

  // knjiga koja se trenutno edituje - null znači da dodajemo novu
  knjigaZaEdit = signal<Book | null>(null);

  // podaci iz forme
  forma: CreateBookRequest = {
    title: '',
    author: '',
    isbn: '',
    genre: '',
    totalCopies: 1
  };

  constructor(
    private bookService: BookService,
    private authService: AuthService
  ) {}

  ngOnInit() {
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

  otvoriFormuZaDodavanje() {
    // resetujemo formu i otvaramo je za dodavanje nove knjige
    this.knjigaZaEdit.set(null);
    this.forma = { title: '', author: '', isbn: '', genre: '', totalCopies: 1 };
    this.prikaziFormu.set(true);
    this.poruka.set('');
    this.greska.set('');
  }

  otvoriFormuZaEdit(knjiga: Book) {
    // popunjavamo formu sa postojećim podacima knjige
    this.knjigaZaEdit.set(knjiga);
    this.forma = {
      title: knjiga.title,
      author: knjiga.author,
      isbn: knjiga.isbn,
      genre: knjiga.genre,
      totalCopies: knjiga.totalCopies
    };
    this.prikaziFormu.set(true);
    this.poruka.set('');
    this.greska.set('');
  }

  sacuvaj() {
    const uEditModu = this.knjigaZaEdit();

    if (uEditModu) {
      // editujemo postojeću knjigu
      this.bookService.update(uEditModu.id, this.forma).subscribe({
        next: () => {
          this.poruka.set('Knjiga uspešno izmenjena.');
          this.prikaziFormu.set(false);
          this.ucitajKnjige();
        },
        error: (err) => {
          this.greska.set(err.error?.poruka || 'Greška pri izmeni knjige.');
        }
      });
    } else {
      // dodajemo novu knjigu
      this.bookService.create(this.forma).subscribe({
        next: () => {
          this.poruka.set('Knjiga uspešno dodata.');
          this.prikaziFormu.set(false);
          this.ucitajKnjige();
        },
        error: (err) => {
          this.greska.set(err.error?.poruka || 'Greška pri dodavanju knjige.');
        }
      });
    }
  }

  obrisi(id: number) {
    // tražimo potvrdu pre brisanja
    if (!confirm('Da li ste sigurni da želite da obrišete ovu knjigu?')) {
      return;
    }

    this.bookService.delete(id).subscribe({
      next: () => {
        this.poruka.set('Knjiga obrisana.');
        this.ucitajKnjige();
      },
      error: (err) => {
        this.greska.set(err.error?.poruka || 'Greška pri brisanju knjige.');
      }
    });
  }

  zatvoriFormu() {
    this.prikaziFormu.set(false);
    this.greska.set('');
  }

  get trenutniKorisnik() {
    return this.authService.trenutniKorisnik();
  }

  odjavi() {
    this.authService.odjavi();
  }
}