import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../shared/services/api.service';
import { UserAdmin } from '../../shared/models/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Korisnici</h1>
    </div>

    <div *ngIf="loading()" class="loading">Učitavanje...</div>

    <table class="data-table" *ngIf="!loading()">
      <thead>
        <tr>
          <th>Ime</th>
          <th>Email</th>
          <th>Uloga</th>
          <th>Treninga</th>
          <th>Registrovan</th>
          <th>Akcije</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let u of users()">
          <td>{{ u.name }}</td>
          <td>{{ u.email }}</td>
          <td><span class="badge" [class.badge-admin]="u.role === 'admin'">{{ u.role }}</span></td>
          <td>{{ u.workoutCount }}</td>
          <td>{{ u.createdAt | date:'dd.MM.yyyy' }}</td>
          <td>
            <button class="btn-danger-sm" (click)="delete(u)" *ngIf="u.role !== 'admin'">Obriši</button>
          </td>
        </tr>
      </tbody>
    </table>
  `,
})
export class AdminUsersComponent implements OnInit {
  users = signal<UserAdmin[]>([]);
  loading = signal(true);

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getUsers().subscribe(u => {
      this.users.set(u);
      this.loading.set(false);
    });
  }

  delete(user: UserAdmin) {
    if (!confirm(`Obrisati korisnika "${user.name}"?`)) return;
    this.adminService.deleteUser(user.id).subscribe(() =>
      this.users.update(arr => arr.filter(u => u.id !== user.id))
    );
  }
}
