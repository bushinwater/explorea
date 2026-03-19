import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TodoService } from '../../services/api.services';
import { TodoItem, PredefinedTask } from '../../models/models';

@Component({
    selector: 'app-dashboard',
    imports: [ReactiveFormsModule], // koristimo za reaktivne forme
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
    private todoService = inject(TodoService);
    private fb = inject(FormBuilder);

    todos = signal<TodoItem[]>([]);
    predefined = signal<PredefinedTask[]>([]);
    loading = signal(true);
    error = signal('');

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
    });

    ngOnInit() {
        this.loadTodos();
        this.loadPredefined();
    }

    loadTodos() {
        this.loading.set(true);
        this.todoService.getAll().subscribe({
            next: (items) => {
                this.todos.set(items);
                this.loading.set(false);
            },
            error: () => {
                this.error.set('Greska pri ucitavanju zadataka.');
                this.loading.set(false);
            },
        });
    }

    loadPredefined() {
        this.todoService.getPredefined().subscribe({
            next: (items) => this.predefined.set(items),
        });
    }

    addTodo() {
        if (this.form.invalid) return;
        const { title, description } = this.form.value; // uzimamo unete vrednosti
        this.todoService.create(title!, description || undefined).subscribe({ // title obavezna, a ovo nije
            next: (item) => {
                this.todos.update(prev => [item, ...prev]); // stavi novi na pocetak niza
                this.form.reset();
            },
            error: () => this.error.set('Greska pri dodavanju zadatka.'),
        });
    }

    addFromPredefined(task: PredefinedTask) {
        this.todoService.create(task.title, task.description || undefined).subscribe({
            next: (item) => this.todos.update(prev => [item, ...prev]),
            error: () => this.error.set('Greska pri dodavanju zadatka.'),
        });
    }

    toggle(id: number) {
        this.todoService.toggle(id).subscribe({
            next: (updated) => {
                this.todos.update(prev =>
                    prev.map(t => t.id === updated.id ? updated : t)
                );
            },
            error: () => this.error.set('Greska pri azuriranju zadatka.'),
        });
    }

    delete(id: number) {
        this.todoService.delete(id).subscribe({
            next: () => this.todos.update(prev => prev.filter(t => t.id !== id)),
            error: () => this.error.set('Greska pri brisanju zadatka.'),
        });
    }
}
