import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshDone$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();

  const addAuth = (t: string) =>
    req.clone({ headers: req.headers.set('Authorization', `Bearer ${t}`) });

  return next(token ? addAuth(token) : req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || req.url.includes('/api/auth/')) {
        return throwError(() => error);
      }

      const refreshToken = authService.getRefreshToken();

      if (!refreshToken) {
        authService.clearTokens();
        void router.navigate(['/login']);
        return throwError(() => error);
      }

      if (isRefreshing) {
        return refreshDone$.pipe(
          filter((t) => t !== null),
          take(1),
          switchMap((newToken) => next(addAuth(newToken!))),
        );
      }

      isRefreshing = true;
      refreshDone$.next(null);

      return authService.refresh({ refreshToken }).pipe(
        switchMap((response) => {
          isRefreshing = false;
          authService.saveTokens(response);
          const newToken = response.accessToken ?? '';
          refreshDone$.next(newToken);
          return next(addAuth(newToken));
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          authService.clearTokens();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
