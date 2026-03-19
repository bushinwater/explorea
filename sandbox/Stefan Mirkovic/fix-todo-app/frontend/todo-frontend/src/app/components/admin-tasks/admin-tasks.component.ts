import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService } from '../../services/api.services';
import { PredefinedTask } from '../../models/models';
import { destroyDetachedRouteHandle } from '@angular/router';

@Component({
    selector: 'app-admin-tasks',
    imports: [ReactiveFormsModule], // reaktivne forme
    templateUrl: './admin-tasks.component.html',
    styleUrl: './admin-tasks.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTasksComponent implements OnInit {
    private adminService = inject(AdminService);
    private fb = inject(FormBuilder);

    tasks = signal<PredefinedTask[]>([]);
    loading = signal(true);
    error = signal('');

    form = this.fb.group({
        title: ['', Validators.required], // obavezno polje forme
        description: [''],
    })

    ngOnInit() {
        this.adminService.getPredefined().subscribe({
            next: (t) => {
                this.tasks.set(t);
                this.loading.set(false);
            },
            error: () => {
                this.error.set('Greska pri ucitavanju zadataka.');
                this.loading.set(false);
            },
        })
    }

    addTask() {
        if (this.form.invalid) return;
        const { title, description } = this.form.value;
        this.adminService.createPredefined(title!, description || undefined).subscribe({
            next: (task) => {
                this.tasks.update(prev => [task, ...prev]);
                this.form.reset();
            },
            error: () => this.error.set('Greška pri dodavanju zadatka.'),
        });
    }

    deleteTask(id: number, title: string) {
        if (!confirm(`Obrisi predefinisani zadatak: ${title} ?`)) return;
        this.adminService.deletePredefined(id).subscribe({
            next: () => this.tasks.update(prev => prev.filter(t => t.id !== id)),
            error: () => this.error.set('Greška pri brisanju zadatka.'),
        })
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString('sr-RS')
    }
}