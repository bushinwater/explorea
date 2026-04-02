import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  isOpen = false;
  isExpanded = false;
  langPopupOpen = false;
  langPopupTop = 0;
  langPopupLeft = 0;

  constructor(
    public themeService: ThemeService,
    public languageService: LanguageService
  ) {}

  toggle() {
    if (window.innerWidth >= 769) {
      this.isExpanded = !this.isExpanded;
    } else {
      this.isOpen = !this.isOpen;
    }
  }

  toggleLangPopup(event: MouseEvent) {
    if (this.langPopupOpen) {
      this.langPopupOpen = false;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.langPopupTop = rect.top;
    this.langPopupLeft = rect.right + 8;
    this.langPopupOpen = true;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.langPopupOpen && !target.closest('.lang-wrapper') && !target.closest('.lang-popup')) {
      this.langPopupOpen = false;
    }
  }

  setLang(lang: 'sr' | 'en') {
    this.languageService.set(lang);
    this.langPopupOpen = false;
  }
}
