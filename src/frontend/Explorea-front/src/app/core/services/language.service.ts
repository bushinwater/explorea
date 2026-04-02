import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly STORAGE_KEY = 'language';
  current: 'sr' | 'en' = 'sr';

  constructor(private translate: TranslateService) {
    const saved = localStorage.getItem(this.STORAGE_KEY) as 'sr' | 'en' | null;
    this.current = saved ?? 'sr';
    this.translate.use(this.current);
  }

  set(lang: 'sr' | 'en') {
    this.current = lang;
    localStorage.setItem(this.STORAGE_KEY, lang);
    this.translate.use(lang);
  }
}
