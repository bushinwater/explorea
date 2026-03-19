import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private auth = inject(AuthService);
    private router = inject(Router);

    form = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
    });

    error = signal('');
    loading = signal(false);

    submit() {
        if (this.form.invalid) return;
        this.loading.set(true);
        this.error.set('');
        const { email, password } = this.form.value;
        this.auth.login(email!, password!).subscribe({
            next: (res) => {
                if (res.role === 'Admin') this.router.navigate(['/admin']);
                else this.router.navigate(['/dashboard']);
            },
            error: () => {
                this.error.set('Pogresan email ili lozinka.');
                this.loading.set(false);
            },
        });
    }
}
