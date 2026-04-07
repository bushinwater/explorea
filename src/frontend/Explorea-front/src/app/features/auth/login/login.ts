import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LoginDto } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Sidebar, TranslateModule, BottomNav],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  email = '';
  password = '';
  error = '';
  returnUrl = '/home';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/home';
  }

  login() {
    const dto: LoginDto = {
      email: this.email,
      password: this.password,
    };

    this.authService.login(dto).subscribe({
      next: (response) => {
        this.authService.saveTokens(response);
        if (response.needsInterests) {
          this.router.navigate(['/interests']);
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: () => {
        this.error = 'LOGIN.ERROR';
      },
    });
  }
}
