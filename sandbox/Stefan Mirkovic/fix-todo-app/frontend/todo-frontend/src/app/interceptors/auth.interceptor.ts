/// sluzi kako bi nam svaki http zahtev proso kroz njega pre nego sto ode na backend
// jer svaki zasticen endpoint ocekuje JWT token, pa da ne bi morali da dodajemo token rucno na svaki http poziv

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.services';

export const authInterceptor: HttpInterceptorFn = (req, next) => { // req - trenutni http zahtev, next je fun koja pusta zahtev dalje ka serveru
    const auth = inject(AuthService);
    const token = auth.getToken();
    if (token) {
        req = req.clone({setHeaders: {Authorization: `Bearer ${token}`}}); // http zahtevi se ne mogu menjati direktno pa mora clone sa dodatnim headerom
    }
    return next(req);
}