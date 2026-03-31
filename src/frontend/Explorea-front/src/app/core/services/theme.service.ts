import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'theme';
  isDark = true;

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    this.isDark = saved ? saved === 'dark' : true; // true je ako postoji uopste ta promenjiva i ako je dark
    this.apply();
  }

  toggle() {
    this.isDark = !this.isDark;
    localStorage.setItem(this.STORAGE_KEY, this.isDark ? 'dark' : 'light');
    this.apply();
  }

  private apply() {
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
  }
}
