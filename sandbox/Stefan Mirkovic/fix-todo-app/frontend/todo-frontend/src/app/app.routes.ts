import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard } from './guards/guards';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ShellComponent } from './components/shell/shell.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { AdminUsersComponent } from './components/admin-users/admin-users.component';
import { AdminTasksComponent } from './components/admin-tasks/admin-tasks.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
    { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },

    {
        path: '',
        component: ShellComponent, // omotac sa sidebarom, tako da sve rute unutar children se renderuju unutar shell-a, ako korisnik nije prijavljen ne moze pristupiti ni jednoj
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', component: DashboardComponent },
            {
                path: 'admin',
                canActivate: [adminGuard],
                children: [
                    { path: '', component: AdminDashboardComponent },
                    { path: 'users', component: AdminUsersComponent },
                    { path: 'tasks', component: AdminTasksComponent },
                ],
            },
        ],
    },

    { path: '**', redirectTo: 'login' }, // sve putanje koje nisu definisane idu na login, za svaki sluc
];
