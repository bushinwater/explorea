// guard sluzi da cuva stranice kojima korisnik ne sme da pristupi
// tj npr authGuard cuva rute kojima korisnik ne sme da pristupi dok se ne uloguje

import { inject, Inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.services";

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.isLoggedIn()) return true;
    router.navigate(['/login']);
    return false;
}

export const adminGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.isAdmin()) return true;
    router.navigate(['/dashboard']);
    return false;
};

export const guestGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) return true;
    if (auth.isAdmin()) router.navigate(['/admin']);
    else router.navigate(['/dashboard']);
    return false;
};
