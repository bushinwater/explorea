import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// interceptor presreće svaki HTTP zahtev pre nego što ode na server
// i automatski dodaje JWT token u header
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // ako nemamo token (korisnik nije ulogovan), šaljemo zahtev bez izmena
  if (!token) {
    return next(req);
  }

  // kloniramo zahtev i dodajemo Authorization header sa tokenom
  // moramo da kloniramo jer su HTTP zahtevi immutable (ne mogu se menjati direktno)
  const zahtevSaTokenom = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(zahtevSaTokenom);
};