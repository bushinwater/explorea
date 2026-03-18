// knjiga u katalogu - odgovara BookResponse DTO iz backenda
export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  genre: string;
  totalCopies: number;
  availableCopies: number;
  // da li trenutno ulogovani korisnik ima aktivnu rezervaciju za ovu knjigu
  hasActiveReservation: boolean;
}

// šta šaljemo kada admin dodaje ili menja knjigu
export interface CreateBookRequest {
  title: string;
  author: string;
  isbn: string;
  genre: string;
  totalCopies: number;
}