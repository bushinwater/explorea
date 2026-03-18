import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // podrazumevana ruta - ako ode na "/" prebaci na login
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // login stranica - dostupna svima
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then(m => m.LoginComponent)
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register.component').then(m => m.RegisterComponent)
  },

  // korisničke rute - zaštićene sa authGuard (mora biti ulogovan)
  {
    path: 'user',
    canActivate: [authGuard],
    children: [
      {
        path: 'books',
        loadComponent: () =>
          import('./user/book-list/book-list.component').then(m => m.BookListComponent)
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./user/my-reservations/my-reservations.component').then(m => m.MyReservationsComponent)
      },
      // ako ode na /user bez ičega, prebaci na /user/books
      {
        path: '',
        redirectTo: 'books',
        pathMatch: 'full'
      }
    ]
  },

  // admin rute - zaštićene sa oba guarda (mora biti ulogovan I mora biti admin)
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: 'books',
        loadComponent: () =>
          import('./admin/admin-books/admin-books.component').then(m => m.AdminBooksComponent)
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./admin/admin-reservations/admin-reservations.component').then(m => m.AdminReservationsComponent)
      },
      // ako ode na /admin bez ičega, prebaci na /admin/books
      {
        path: '',
        redirectTo: 'books',
        pathMatch: 'full'
      }
    ]
  },

  // ako ode na nepostojeću rutu, vrati na login
  {
    path: '**',
    redirectTo: 'login'
  }
];