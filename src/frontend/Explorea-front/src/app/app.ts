import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Explorea-front');

  constructor(
    private themeService: ThemeService,
    private languageService: LanguageService,
    private http: HttpClient
  ) {
    this.http.get<{ countryName: string }>('/api/app-info').subscribe({
      next: (info) => {
        document.title = `Explorea - ${info.countryName}`;
      },
      error: () => {
        document.title = 'Explorea';
      }
    });
  }
}
