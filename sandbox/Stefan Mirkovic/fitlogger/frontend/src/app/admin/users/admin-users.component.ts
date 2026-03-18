import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../shared/services/api.service';
import { UserAdmin } from '../../shared/models/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.component.html',
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
