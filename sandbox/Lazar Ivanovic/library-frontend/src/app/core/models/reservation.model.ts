// rezervacija koju korisnik vidi - samo njegove rezervacije
export interface Reservation {
  id: number;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  status: 'pending' | 'approved' | 'returned' | 'cancelled';
  reservedAt: string;
  expiresAt: string;
  borrowedAt?: string;  // opciono - popunjava se kada admin odobri
  returnedAt?: string;  // opciono - popunjava se kada se knjiga vrati
}

// rezervacija koju admin vidi - ima i podatke o korisniku
export interface AdminReservation {
  id: number;
  bookId: number;
  bookTitle: string;
  userId: number;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'returned' | 'cancelled';
  reservedAt: string;
  expiresAt: string;
  borrowedAt?: string;
  returnedAt?: string;
}