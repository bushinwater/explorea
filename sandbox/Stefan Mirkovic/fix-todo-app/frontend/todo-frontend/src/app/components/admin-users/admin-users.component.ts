import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { AdminService } from '../../services/api.services';
import { UserAdmin } from '../../models/models';

@Component({
    selector: 'app-admin-users',
    imports: [],
    templateUrl: './admin-users.component.html', // style koristimo globalni
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersComponent implements OnInit {
    private adminService = inject(AdminService);

    users = signal<UserAdmin[]>([]); // prazna lista na pocetku
    loading = signal(true);
    error = signal('');

    ngOnInit() {
        this.adminService.getUsers().subscribe({
            next: (u) => {
                this.users.set(u);
                this.loading.set(false);
            },
            error: () => {
                this.error.set('Greska pri ucitavanju korisnika.');
                this.loading.set(false);
            },
        });
    }

    deleteUser(id: string, name: string) {
        if (!confirm(`Obrisi korisnika "${name}"?`)) return;
        this.adminService.deleteUser(id).subscribe({
            next: () => this.users.update(prev => prev.filter(u => u.id !== id)),
            error: () => this.error.set('Greska pri brisanju korisnika.'),
        });
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString('sr-RS');
    }
}
