import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
    selector: 'app-register',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './register.component.html',
    styleUrl: '../login/login.component.css', // posto je stil koji koristim isti ko u login-u
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
    private fb = inject(FormBuilder);
    private auth = inject(AuthService);
    private router = inject(Router);

    form = this.fb.group({
        fullName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
    });

    error = signal('');
    loading = signal(false);

    submit() {
        if (this.form.invalid) return;
        this.loading.set(true);
        this.error.set('');
        const { fullName, email, password } = this.form.value;
        this.auth.register(email!, password!, fullName!).subscribe({
            next: () => this.router.navigate(['/login']),
            error: () => {
                this.error.set('Registracija nije uspela. Pokusajte ponovo.');
                this.loading.set(false);
            },
        });
    }
}
