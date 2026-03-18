import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// štiti rute koje zahtevaju login
// ako korisnik nije ulogovan, šalje ga na /login
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.jeUlogovan()) {
    return true; // dozvoli pristup
  }

  // nije ulogovan - prebaci na login
  router.navigate(['/login']);
  return false;
};

// štiti admin rute
// ako korisnik nije admin, šalje ga nazad na /user/books
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.jeAdmin()) {
    return true; // dozvoli pristup
  }

  // nije admin - prebaci na korisničke knjige
  router.navigate(['/user/books']);
  return false;
};