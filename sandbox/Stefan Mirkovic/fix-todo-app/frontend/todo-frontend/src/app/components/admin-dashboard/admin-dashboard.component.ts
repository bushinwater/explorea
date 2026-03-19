import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { AdminService } from '../../services/api.services';
import { AdminStats } from '../../models/models';

@Component({
    selector: 'app-admin-dashboard',
    imports: [],
    templateUrl: './admin-dashboard.component.html',
    styleUrl: './admin-dashboard.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush, // on push znaci da samo proveri da li se nesto promenilo kada se promeni input, signal ili se emituje neki event
})
export class AdminDashboardComponent implements OnInit {
    private adminService = inject(AdminService);
    stats = signal<AdminStats | null>(null);
    loading = signal(true);

    ngOnInit() {
        this.adminService.getStats().subscribe({
            // subscribe vraca 3 kljuca, next: kada je odgovor uspesan, error ako dodje do greske i complete koji se retko koristi
            next: (s) => {
                this.stats.set(s);
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }
}