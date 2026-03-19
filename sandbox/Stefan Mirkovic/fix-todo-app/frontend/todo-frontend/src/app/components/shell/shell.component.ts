import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
    auth = inject(AuthService);
}
