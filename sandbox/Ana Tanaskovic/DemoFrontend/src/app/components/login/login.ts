import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = '';
  password = '';

  @Output() loginSuccess = new EventEmitter<void>();

  constructor(private auth: Auth) {}

  login() {
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.loginSuccess.emit(),
      error: () => alert('Pogresan username ili password'),
    });
  }
}
