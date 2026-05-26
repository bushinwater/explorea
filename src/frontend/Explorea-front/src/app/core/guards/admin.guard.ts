import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const checkRole = (): true | ReturnType<typeof router.createUrlTree> => {
    const role = auth.getRole();
    return role && role !== 'traveler' ? true : router.createUrlTree(['/']);
  };

  if (auth.isLoggedIn()) return checkRole();

  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return auth.refresh({ refreshToken }).pipe(
    map((response) => {
      auth.saveTokens(response);
      return checkRole();
    }),
    catchError(() => {
      auth.clearTokens();
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    }),
  );
};
