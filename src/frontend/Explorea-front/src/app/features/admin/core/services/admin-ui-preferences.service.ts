import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, of, tap } from 'rxjs';

export type AdminLanguage = 'sr' | 'en';
export type AdminTheme = 'dark' | 'light' | 'system';

@Injectable({ providedIn: 'root' })
export class AdminUiPreferencesService {
  private readonly themeStorageKey = 'admin-theme';
  private readonly languageStorageKey = 'admin-language';
  private readonly loadedDictionaries = new Map<AdminLanguage, Record<string, string>>();

  readonly language = signal<AdminLanguage>('sr');
  readonly theme = signal<AdminTheme>('dark');
  readonly isDark = signal(true);
  readonly dictionary = signal<Record<string, string>>({});

  constructor(private readonly http: HttpClient) {}

  // async initialize(): Promise<void> {
  //   const savedLanguage = this.readLanguage();
  //   const savedTheme = this.readTheme();

  //   this.language.set(savedLanguage ?? 'sr');
  //   this.isDark.set(savedTheme ? savedTheme === 'dark' : true);
  //   this.applyTheme();
  //   await this.loadDictionary(this.language());
  // }

  async initialize(): Promise<void> {
    const savedLanguage = this.readLanguage();
    const savedTheme = this.readTheme();

    this.language.set(savedLanguage ?? 'sr');
    this.setTheme(savedTheme ?? 'dark', false);
    await this.loadDictionary(this.language());
  }

  setTheme(theme: AdminTheme, persist = true): void {
    this.theme.set(theme);

    if (persist) localStorage.setItem(this.themeStorageKey, theme);

    this.isDark.set(this.resolveIsDark(theme));
    this.applyTheme();
  }

  setLanguage(language: AdminLanguage): void {
    this.language.set(language);
    localStorage.setItem(this.languageStorageKey, language);
    void this.loadDictionary(language);
  }

  // toggleTheme(): void {
  //   this.isDark.update((current) => !current);
  //   localStorage.setItem(this.themeStorageKey, this.isDark() ? 'dark' : 'light');
  //   this.applyTheme();
  // }

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  t(key: string, params?: Record<string, string | number>): string {
    const template = this.dictionary()[key] ?? key;

    if (!params) {
      return template;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, value]) => result.replaceAll(`{${paramKey}}`, String(value)),
      template,
    );
  }

  private async loadDictionary(language: AdminLanguage): Promise<void> {
    const cached = this.loadedDictionaries.get(language);
    if (cached) {
      this.dictionary.set(cached);
      return;
    }

    const dictionary = await firstValueFrom(
      this.http.get<Record<string, string>>(`/assets/i18n/admin-${language}.json`).pipe(
        tap((loaded) => {
          this.loadedDictionaries.set(language, loaded);
          this.dictionary.set(loaded);
        }),
        catchError(() => {
          const fallback = {};
          this.loadedDictionaries.set(language, fallback);
          this.dictionary.set(fallback);
          return of(fallback);
        }),
      ),
    );

    this.dictionary.set(dictionary);
  }

  private resolveIsDark(theme: AdminTheme): boolean {
    if (theme === 'system') {
      return typeof window !== 'undefined'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : true;
    }

    return theme === 'dark';
  }

  private applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
  }

  private readLanguage(): AdminLanguage | null {
    const saved = localStorage.getItem(this.languageStorageKey);
    if (saved === 'sr' || saved === 'en') return saved;
    const appLang = localStorage.getItem('language');
    return appLang === 'sr' || appLang === 'en' ? appLang : null;
  }

  // private readTheme(): string | null {
  //   return localStorage.getItem(this.themeStorageKey);
  // }

  private readTheme(): AdminTheme | null {
    const savedTheme = localStorage.getItem(this.themeStorageKey);
    return savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system'
      ? savedTheme
      : null;
  }
}
